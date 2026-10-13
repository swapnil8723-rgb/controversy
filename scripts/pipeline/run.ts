// Daily auto-update. Runs free on GitHub Actions (see .github/workflows/daily.yml):
//   1. Freshness: archive stories quiet for 30+ days with nothing scheduled, clear passed dates.
//   2. Discover: free publisher RSS feeds, last 36 hours, dispute vocabulary only.
//   3. Triage (AI): group headlines, match existing stories, score risk and reader interest.
//   4. Update existing stories with genuinely new developments.
//   5. Draft new stories from at least two outlets' article text.
// Every AI draft is checked by validate.ts, then by `npm run verify` and the build in CI.
// Publishing policy (AUTO_PUBLISH): "low" (default) publishes low-risk drafts and parks
// medium-risk ones in drafts/ for a human; "all" publishes both; "none" parks everything.
//
//   node scripts/pipeline/run.ts            (needs GEMINI_API_KEY for steps 3-5)
import fs from 'node:fs';
import path from 'node:path';
import { makeAi, OverBudget } from './ai.ts';
import { discover, readPage, type Page } from './sources.ts';
import { TRIAGE_SYSTEM, TRIAGE_SCHEMA, DRAFT_SYSTEM, DRAFT_SCHEMA, UPDATE_SYSTEM, UPDATE_SCHEMA, articlesBlock } from './prompts.ts';
import { validateRecord } from './validate.ts';
import { RECORDS, ENTITIES, ARCHIVE, DRAFTS, listRecords, readDoc, writeDoc, entityExists, slugify, move, loadState, saveState, tierFor, type Doc } from './store.ts';

const TODAY = new Date().toISOString().slice(0, 10);
const FRESH_DAYS = 30;
const AUTO = (process.env.AUTO_PUBLISH || 'low').toLowerCase();
const MAX_NEW = Number(process.env.MAX_NEW || 4);
const MAX_UPDATES = Number(process.env.MAX_UPDATES || 6);
const AUTO_LABEL = 'Auto-drafted by AI from cited reporting; not yet human-reviewed';
const log: string[] = [];
const say = (s: string) => {
  console.log(s);
  log.push(s);
};
const days = (a: string, b: string) => Math.round((Date.parse(a) - Date.parse(b)) / 864e5);
const lastEvent = (d: Doc) => String(d.data.timeline.at(-1).date).slice(0, 10);

// 1. Freshness maintenance (no AI needed).
function maintain() {
  for (const d of listRecords()) {
    let changed = false;
    if (d.data.next && String(d.data.next.date).slice(0, 10) < TODAY) {
      delete d.data.next;
      changed = true;
    }
    const quiet = days(TODAY, lastEvent(d));
    const nextIn = d.data.next ? days(String(d.data.next.date).slice(0, 10), TODAY) : Infinity;
    if (quiet > FRESH_DAYS && nextIn > FRESH_DAYS) {
      move(d.file, path.join(ARCHIVE, 'records', d.data.vertical, `${d.slug}.md`));
      say(`archived ${d.slug} (quiet for ${quiet} days)`);
      continue;
    }
    if (changed) {
      writeDoc(d.file, d.data, d.body);
      say(`cleared passed date on ${d.slug}`);
    }
  }
  // Entities no live story references move to the archive too.
  const used = new Set(listRecords().flatMap((d) => d.data.entities as string[]));
  for (const f of fs.readdirSync(ENTITIES)) {
    const slug = f.replace(/\.md$/, '');
    if (!used.has(slug)) move(path.join(ENTITIES, f), path.join(ARCHIVE, 'entities', f));
  }
}

function sourcesFrom(pages: Page[], prefix: string) {
  return pages.map((p, i) => ({
    id: `${prefix}${i + 1}`,
    name: p.outlet,
    title: p.title || p.outlet,
    url: p.url,
    ...(p.publishedAt ? { published: p.publishedAt.slice(0, 10) } : {}),
    accessed: TODAY,
    tier: tierFor(p.outlet),
  }));
}

function mapClaims(claims: any[] | undefined, ids: string[]) {
  return (claims ?? []).map((c) => ({
    text: String(c.text ?? '').trim(),
    kind: c.kind,
    ...(c.by ? { by: c.by } : {}),
    cite: [...new Set((c.cite ?? []).map((n: number) => ids[n - 1]).filter(Boolean))],
  }));
}

async function readArticles(urls: string[], max: number) {
  const pages: Page[] = [];
  for (const u of urls) {
    if (pages.length >= max) break;
    const p = await readPage(u);
    if (p && !pages.some((x) => x.url === p.url)) pages.push(p);
  }
  return pages;
}

async function main() {
  maintain();
  const deadline = Date.now() + 25 * 60e3;
  const ai = makeAi({ maxCalls: Number(process.env.MAX_AI_CALLS || 40), deadline });
  if (!ai.available) {
    say('No GEMINI_API_KEY (or ANTHROPIC_API_KEY): freshness maintenance only.');
    return finish();
  }
  const state = loadState();
  state.runs++;
  const fresh = (await discover(36, say)).filter((i) => !state.seen[i.url]);
  fresh.sort((a, b) => Date.parse(b.publishedAt ?? '0') - Date.parse(a.publishedAt ?? '0'));
  const items = fresh.slice(0, 80);
  say(`discovered ${fresh.length} new dispute headlines, triaging ${items.length}`);
  for (const i of items) state.seen[i.url] = TODAY;
  if (!items.length) return finish(state);

  const live = listRecords();
  const triage = await ai.json<{ stories: any[] }>(
    TRIAGE_SYSTEM,
    `Today is ${TODAY}.\n\nStories we already cover:\n${live.map((d) => `- ${d.slug} (${d.data.vertical}): ${d.data.title}`).join('\n')}\n\nHeadlines:\n${items.map((i, n) => `${n + 1}. [${i.hint}] ${i.outlet}: ${i.title} | ${i.description}`).join('\n')}`,
    TRIAGE_SCHEMA,
  );
  const stories = (triage.stories ?? []).filter((s) => s.risk !== 'high');
  const urlsOf = (s: any) => (s.items as number[]).map((n) => items[n - 1]?.url).filter(Boolean) as string[];

  // 4. Updates to stories we already cover.
  let updates = 0;
  for (const s of stories.filter((x) => x.existingId && live.some((d) => d.slug === x.existingId)).sort((a, b) => b.worth - a.worth)) {
    if (updates >= MAX_UPDATES) break;
    const doc = live.find((d) => d.slug === s.existingId)!;
    const pages = await readArticles(urlsOf(s), 3);
    if (!pages.length) continue;
    try {
      const recent = doc.data.timeline.slice(-3).map((t: any) => `${String(t.date).slice(0, 10)}: ${t.headline}`).join('\n');
      const r = await ai.json<any>(
        UPDATE_SYSTEM,
        `Today is ${TODAY}.\nRecord: ${doc.data.title}\nStatus: ${doc.data.status} | ${doc.data.statusNote}\nLatest events:\n${recent}\n\nNew articles:\n${articlesBlock(pages)}`,
        UPDATE_SCHEMA,
      );
      if (!r.newDevelopment || !r.event) continue;
      const stamp = TODAY.replaceAll('-', '');
      const srcs = sourcesFrom(pages, `u${stamp}-`);
      const ids = srcs.map((x) => x.id);
      const next = structuredClone(doc.data);
      const ev = { date: r.event.date, ...(r.event.dateLabel ? { dateLabel: r.event.dateLabel } : {}), headline: r.event.headline, claims: mapClaims(r.event.claims, ids) };
      if (ev.date <= lastEvent(doc)) continue;
      next.timeline.push(ev);
      next.responses = [...(next.responses ?? []), ...mapClaims(r.responses, ids)];
      const cited = new Set([...ev.claims, ...next.responses].flatMap((c: any) => c.cite));
      next.sources.push(...srcs.filter((x) => cited.has(x.id)));
      if (r.status) next.status = r.status;
      if (r.statusNote) next.statusNote = r.statusNote;
      if (r.next?.date && r.next.date >= TODAY) next.next = r.next;
      next.updated = TODAY;
      next.lastVerified = TODAY;
      if (!String(next.reviewedBy).startsWith('Auto')) next.reviewedBy = `${next.reviewedBy}; latest update auto-drafted, not yet human-reviewed`.slice(0, 200);
      const errs = validateRecord(next, TODAY);
      if (errs.length) {
        say(`update rejected for ${doc.slug}: ${errs.slice(0, 3).join('; ')}`);
        continue;
      }
      writeDoc(doc.file, next, doc.body);
      updates++;
      say(`updated ${doc.slug}: ${ev.headline}`);
    } catch (e) {
      if (e instanceof OverBudget) break;
      say(`update failed for ${doc.slug}: ${(e as Error).message}`);
    }
  }

  // 5. New stories.
  let created = 0;
  const allowed = (risk: string) => (AUTO === 'all' ? true : AUTO === 'low' ? risk === 'low' : false);
  for (const s of stories.filter((x) => !x.existingId && x.worth >= 6).sort((a, b) => b.worth - a.worth)) {
    if (created >= MAX_NEW) break;
    const urls = urlsOf(s);
    if (new Set(urls.map((u) => new URL(u).hostname)).size < 2) continue; // two outlets minimum
    const pages = await readArticles(urls, 4);
    if (new Set(pages.map((p) => p.outlet)).size < 2) continue;
    try {
      const d = await ai.json<any>(DRAFT_SYSTEM, `Today is ${TODAY}. Category: ${s.category}. Regions: ${s.regions.join(', ')}.\n\nArticles:\n${articlesBlock(pages)}`, DRAFT_SCHEMA);
      if (d.skip || !d.title) continue;
      const srcs = sourcesFrom(pages, 's');
      const ids = srcs.map((x) => x.id);
      const ents = (d.entities ?? [])
        .map((e: any) => ({ ...e, slug: slugify(e.name, 60) }))
        .filter((e: any) => e.slug && (entityExists(e.slug) || (typeof e.bio === 'string' && e.bio.length >= 60 && e.bio.length <= 360)));
      if (!ents.length) continue;
      const record: Record<string, any> = {
        title: d.title,
        ...(d.seoTitle ? { seoTitle: d.seoTitle } : {}),
        tag: d.tag,
        summary: d.summary,
        tldr: d.tldr,
        vertical: s.category,
        regions: s.regions?.length ? s.regions : ['america'],
        status: d.status,
        statusNote: d.statusNote,
        riskTier: s.risk,
        entities: ents.map((e: any) => e.slug),
        ...(d.next?.date && d.next.date >= TODAY ? { next: d.next } : {}),
        keywords: d.keywords ?? [],
        keyFacts: d.keyFacts ?? [],
        sources: srcs,
        timeline: (d.timeline ?? []).map((t: any) => ({ date: t.date, ...(t.dateLabel ? { dateLabel: t.dateLabel } : {}), headline: t.headline, claims: mapClaims(t.claims, ids) })),
        responses: mapClaims(d.responses, ids),
        ...(d.noResponseFound ? { noResponseFound: { checkedOn: TODAY, note: d.noResponseFound } } : {}),
        published: TODAY,
        updated: TODAY,
        lastVerified: TODAY,
        reviewedBy: AUTO_LABEL,
      };
      // Drop sources nothing cites.
      const cited = new Set([...record.timeline.flatMap((t: any) => t.claims), ...record.responses].flatMap((c: any) => c.cite));
      record.sources = srcs.filter((x) => cited.has(x.id));
      const errs = validateRecord(record, TODAY);
      if (errs.length) {
        say(`draft rejected (${s.headline}): ${errs.slice(0, 3).join('; ')}`);
        continue;
      }
      let slug = slugify(d.title);
      if (fs.existsSync(path.join(RECORDS, s.category, `${slug}.md`))) slug = `${slug}-${TODAY.slice(5).replace('-', '')}`;
      if (allowed(s.risk)) {
        for (const e of ents) {
          if (!entityExists(e.slug)) writeDoc(path.join(ENTITIES, `${e.slug}.md`), { name: e.name, kind: e.kind, vertical: s.category, role: String(e.role).slice(0, 60), bio: e.bio, sameAs: [] });
        }
        writeDoc(path.join(RECORDS, s.category, `${slug}.md`), record);
        say(`published ${slug} (${s.risk} risk)`);
      } else {
        writeDoc(path.join(DRAFTS, 'records', s.category, `${slug}.md`), { ...record, entityDrafts: ents.map(({ slug: _s, ...e }: any) => e) });
        say(`parked draft ${slug} for review (${s.risk} risk)`);
      }
      created++;
    } catch (e) {
      if (e instanceof OverBudget) break;
      say(`draft failed (${s.headline}): ${(e as Error).message}`);
    }
  }
  say(`done: ${updates} updates, ${created} new, ${ai.calls} AI calls`);
  finish(state);
}

function finish(state?: ReturnType<typeof loadState>) {
  if (state) saveState(state, TODAY);
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) fs.appendFileSync(summary, `## Lorecheck daily update ${TODAY}\n\n${log.map((l) => `- ${l}`).join('\n')}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
