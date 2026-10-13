// Publishing gates that sit on top of the content schema (which already blocks unsourced
// claims and unanswered allegations at build time).
//
//   npm run verify            editorial gates; warnings for drafts and missing archives
//   npm run verify:strict     launch mode: drafts and missing archive links also fail
//   npm run verify:links      also requests every source URL
//
// Exit code 1 if any gate fails, so CI blocks the deploy.
import { loadDocs, rel, toDate, type Doc, type Source } from './lib.ts';
import { VERDICT_WORDS } from '../src/lib/taxonomy.ts';

const strict = process.argv.includes('--strict');
const checkLinks = process.argv.includes('--links');
const STALE_DAYS = 14;
const FRESH_DAYS = 30; // the site's freshness window: older stories belong in archive/
const now = new Date();

const errors: string[] = [];
const warnings: string[] = [];
const fail = (d: Doc, msg: string) => errors.push(`${rel(d.file)}: ${msg}`);
const warn = (d: Doc, msg: string) => warnings.push(`${rel(d.file)}: ${msg}`);

const { records, explainers, entities } = loadDocs();
const recordSlugs = new Set(records.map((r) => r.slug));
const entityIds = new Set(entities.map((e) => e.slug));

// Headlines never deliver a verdict a court or official body has not reached.
function verdictGate(d: Doc) {
  const sources: Source[] = d.data.sources ?? [];
  const ruled = (d.data.status === 'resolved' || d.data.status === 'in-court') && sources.some((s) => s.tier === 'court' || s.tier === 'official');
  for (const field of ['title', 'seoTitle', 'summary']) {
    const text = String(d.data[field] ?? '').toLowerCase();
    for (const w of VERDICT_WORDS) {
      if (new RegExp(`\\b${w}\\b`).test(text) && !ruled) fail(d, `${field} uses verdict word "${w}" without a court or official ruling`);
    }
  }
}

function sourceGates(d: Doc) {
  const sources: Source[] = d.data.sources ?? [];
  const urls = new Set<string>();
  for (const s of sources) {
    if (urls.has(s.url)) warn(d, `source "${s.id}" duplicates another source URL`);
    urls.add(s.url);
    if (!s.archiveUrl) (strict ? fail : warn)(d, `source "${s.id}" has no archive link (run npm run archive)`);
  }
  if (String(d.data.reviewedBy ?? '').toLowerCase().startsWith('draft')) (strict ? fail : warn)(d, 'not signed off by an editor (reviewedBy is a draft)');
}

for (const r of records) {
  verdictGate(r);
  sourceGates(r);
  const d = r.data;
  if (d.riskTier === 'high') fail(r, 'high-risk pages are not publishable in phase 1');
  if (r.file.replaceAll('\\', '/').split('/').at(-2) !== d.vertical) fail(r, `file is in the wrong folder for vertical "${d.vertical}"`);
  // Open cases must be re-verified every 14 days.
  if (d.status === 'ongoing' || d.status === 'in-court') {
    const age = (now.getTime() - toDate(d.lastVerified).getTime()) / 864e5;
    if (age > STALE_DAYS) fail(r, `open case last verified ${Math.floor(age)} days ago (limit ${STALE_DAYS}); re-check and update lastVerified`);
  }
  if (toDate(d.updated) < toDate(d.published)) fail(r, 'updated is earlier than published');
  const latest = Math.max(...(d.timeline ?? []).map((t: { date: unknown }) => toDate(t.date).getTime()));
  const quiet = Math.floor((now.getTime() - latest) / 864e5);
  if (quiet > FRESH_DAYS) warn(r, `no new development for ${quiet} days; move it to archive/ unless something new happened`);
  if (d.next && toDate(d.next.date) < new Date(now.toISOString().slice(0, 10))) warn(r, `"next" date ${String(d.next.date).slice(0, 10)} has passed; update the story`);
  for (const e of d.entities ?? []) if (!entityIds.has(e)) fail(r, `unknown entity "${e}"`);
  for (const x of d.related ?? []) if (!recordSlugs.has(x)) fail(r, `unknown related record "${x}"`);
  if (String(d.title).length > 70) fail(r, 'title over 70 characters');
  if ((d.seoTitle ?? d.title).length > 60) warn(r, 'SEO title over 60 characters; set seoTitle');
}

for (const x of explainers) {
  verdictGate(x);
  sourceGates(x);
  for (const ref of x.data.records ?? []) if (!recordSlugs.has(ref)) fail(x, `unknown record "${ref}"`);
}

// Every hub needs at least one record; every record links its hubs (hubs are generated
// from those references, so the back-link is automatic).
const used = new Set(records.flatMap((r) => r.data.entities ?? []));
for (const e of entities) if (!used.has(e.slug)) warn(e, 'entity has no records, so no hub page is built');

// Internal links inside Markdown bodies must point at pages that exist.
const pages = new Set<string>([
  ...records.map((r) => `/${r.data.vertical}/controversies/${r.slug}/`),
  ...explainers.map((x) => `/${x.data.vertical}/explained/${x.slug}/`),
]);
for (const d of [...records, ...explainers]) {
  for (const m of d.body.matchAll(/\]\((\/[^)\s#]*)/g)) {
    const href = m[1];
    if ((href.includes('/controversies/') || href.includes('/explained/')) && !pages.has(href)) fail(d, `broken internal link ${href}`);
  }
}

if (checkLinks) {
  const all = [...records, ...explainers].flatMap((d) => (d.data.sources as Source[]).map((s) => ({ d, s })));
  const unique = new Map<string, { d: Doc; s: Source }>();
  for (const x of all) unique.set(x.s.url, x);
  console.log(`Checking ${unique.size} source URLs…`);
  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
  const queue = [...unique.values()];
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      for (let x = queue.shift(); x; x = queue.shift()) {
        try {
          const res = await fetch(x.s.url, { redirect: 'follow', headers: { 'User-Agent': UA, Accept: 'text/html,*/*' }, signal: AbortSignal.timeout(20000) });
          if (res.status === 404 || res.status === 410) fail(x.d, `source "${x.s.id}" is gone (${res.status}): ${x.s.url}`);
          else if (res.status >= 400) warn(x.d, `source "${x.s.id}" returned ${res.status} (often bot blocking; check by hand): ${x.s.url}`);
        } catch (e) {
          warn(x.d, `source "${x.s.id}" could not be fetched (${(e as Error).name}): ${x.s.url}`);
        }
      }
    }),
  );
}

for (const w of warnings) console.log(`warn  ${w}`);
for (const e of errors) console.log(`FAIL  ${e}`);
console.log(`\n${records.length} records, ${explainers.length} explainers, ${entities.length} entities · ${errors.length} failures, ${warnings.length} warnings${strict ? ' (strict)' : ''}`);
process.exit(errors.length ? 1 : 0);
