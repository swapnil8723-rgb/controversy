import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { VERTICALS, STATUSES, ENTITY_KINDS, TIERS, CLAIM_KINDS } from './lib/taxonomy';

// Legal guards live in the schema, so a page with an unsourced claim, or an allegation
// with no response, cannot build. Sources are declared once per page and cited by id.

const source = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string(), // outlet or body, e.g. "Premier League"
  title: z.string(), // headline or document title
  url: z.string().url(),
  archiveUrl: z.string().url().optional(), // filled by `npm run archive`; required by `npm run verify -- --strict`
  published: z.coerce.date().optional(),
  accessed: z.coerce.date(),
  tier: z.enum(TIERS),
});

const claim = z.object({
  text: z.string().min(20),
  kind: z.enum(CLAIM_KINDS),
  by: z.string().optional(), // who makes an allegation or response
  cite: z.array(z.string()).min(1, 'Every claim needs at least one source'),
});

type Src = z.infer<typeof source>;
type Claim = z.infer<typeof claim>;

function checkClaims(claims: Claim[], sources: Src[], ctx: z.RefinementCtx, where: string) {
  const byId = new Map(sources.map((s) => [s.id, s]));
  for (const c of claims) {
    for (const id of c.cite) {
      if (!byId.has(id)) ctx.addIssue({ code: 'custom', message: `${where}: cites unknown source "${id}"` });
    }
    const tiers = c.cite.map((id) => byId.get(id)?.tier);
    if (c.kind === 'fact' && !tiers.some((t) => t && t !== 'major-outlet')) {
      ctx.addIssue({ code: 'custom', message: `${where}: a "fact" needs an official, court or on-record source (use "reported" otherwise): ${c.text.slice(0, 60)}` });
    }
    if ((c.kind === 'allegation' || c.kind === 'response') && !c.by) {
      ctx.addIssue({ code: 'custom', message: `${where}: allegations and responses must say who makes them ("by")` });
    }
  }
}

const records = defineCollection({
  // Files sit in a folder per vertical, but ids are the bare slug so references stay short.
  loader: glob({ pattern: '**/*.md', base: './src/content/records', generateId: ({ entry }) => entry.replace(/^.*\//, '').replace(/\.md$/, '') }),
  schema: z
    .object({
      title: z.string().max(70),
      seoTitle: z.string().max(60).optional(),
      tag: z.string().max(20), // short label for story bubbles, e.g. "FIFA vs UEFA"
      summary: z.string().max(160),
      tldr: z.array(z.string().max(200)).length(3), // the 30-second version
      vertical: z.enum(VERTICALS),
      status: z.enum(STATUSES),
      statusNote: z.string().max(220), // one line: where it stands today
      riskTier: z.enum(['low', 'medium']), // 'high' is not publishable in phase 1
      entities: z.array(reference('entities')).min(1),
      // The two sides shown as "A vs B" on cards and the page header (defaults to the first two entities).
      faceoff: z.tuple([reference('entities'), reference('entities')]).optional(),
      // The next known date in the story (hearing, deadline, meeting), shown as "What's next".
      next: z.object({ date: z.coerce.date(), label: z.string().max(60) }).optional(),
      keywords: z.array(z.string()).default([]),
      sources: z.array(source).min(2),
      timeline: z
        .array(
          z.object({
            date: z.coerce.date(),
            dateLabel: z.string().optional(), // e.g. "Jan 2025" when only the month is sourced
            headline: z.string().max(90),
            claims: z.array(claim).min(1),
          }),
        )
        .min(3),
      responses: z.array(claim).default([]),
      noResponseFound: z.object({ checkedOn: z.coerce.date(), note: z.string() }).optional(),
      keyFacts: z.array(z.object({ label: z.string(), value: z.string() })).default([]),
      published: z.coerce.date(),
      updated: z.coerce.date(), // change only when facts change
      lastVerified: z.coerce.date(),
      reviewedBy: z.string(),
      corrections: z.array(z.object({ date: z.coerce.date(), note: z.string() })).default([]),
      related: z.array(reference('records')).default([]),
    })
    .superRefine((d, ctx) => {
      d.timeline.forEach((t, i) => checkClaims(t.claims, d.sources, ctx, `timeline[${i}]`));
      checkClaims(d.responses, d.sources, ctx, 'responses');
      const hasAllegation = d.timeline.some((t) => t.claims.some((c) => c.kind === 'allegation'));
      if (hasAllegation && d.responses.length === 0 && !d.noResponseFound) {
        ctx.addIssue({ code: 'custom', message: 'Allegations need a response or a documented no-response check' });
      }
      const ids = d.sources.map((s) => s.id);
      if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', message: 'Duplicate source ids' });
      const dates = d.timeline.map((t) => t.date.getTime());
      if (dates.some((x, i) => i > 0 && x < dates[i - 1])) ctx.addIssue({ code: 'custom', message: 'Timeline must be in date order' });
    }),
});

const entities = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/entities' }),
  schema: z.object({
    name: z.string(),
    kind: z.enum(ENTITY_KINDS),
    vertical: z.enum(VERTICALS),
    role: z.string(), // e.g. "England batter", "Premier League club"
    bio: z.string().min(60).max(360), // neutral, factual one-paragraph description
    country: z.string().optional(),
    short: z.string().max(4).optional(), // avatar label, e.g. "MCFC"; defaults to initials
    sameAs: z.array(z.string().url()).default([]), // Wikipedia / official site
  }),
});

const explainers = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/explainers' }),
  schema: z.object({
    title: z.string().max(80),
    seoTitle: z.string().max(60).optional(),
    summary: z.string().max(160),
    vertical: z.enum(VERTICALS),
    question: z.string(), // the search question this page answers
    shortAnswer: z.string().max(360),
    records: z.array(reference('records')).default([]),
    sources: z.array(source).min(1),
    published: z.coerce.date(),
    updated: z.coerce.date(),
    reviewedBy: z.string(),
  }),
});

export const collections = { records, entities, explainers };
