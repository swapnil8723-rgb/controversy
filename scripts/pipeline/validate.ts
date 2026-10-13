// Mirrors the content schema (src/content.config.ts) and the verify gates, so an AI draft
// that would break the build, or the editorial rules, never reaches the site.
import { VERDICT_WORDS } from '../../src/lib/taxonomy.ts';

const KINDS = ['fact', 'reported', 'allegation', 'response'];
const STATUSES = ['ongoing', 'in-court', 'resolved', 'disputed', 'insufficient-information'];
const isDate = (s: unknown) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

export function validateRecord(d: Record<string, any>, today: string): string[] {
  const e: string[] = [];
  const len = (k: string, v: unknown, max: number, min = 1) => {
    if (typeof v !== 'string' || v.length < min || v.length > max) e.push(`${k} length ${typeof v === 'string' ? v.length : 'missing'} (want ${min}-${max})`);
  };
  len('title', d.title, 70);
  if (d.seoTitle) len('seoTitle', d.seoTitle, 60);
  len('tag', d.tag, 20);
  len('summary', d.summary, 160);
  len('statusNote', d.statusNote, 220);
  if (!Array.isArray(d.tldr) || d.tldr.length !== 3) e.push('tldr must have 3 lines');
  else d.tldr.forEach((t: string, i: number) => len(`tldr${i}`, t, 200));
  if (!STATUSES.includes(d.status)) e.push('bad status');
  if (!Array.isArray(d.regions) || !d.regions.length) e.push('no regions');
  if (!['low', 'medium'].includes(d.riskTier)) e.push('risk tier not publishable');
  const ids = new Set((d.sources ?? []).map((s: any) => s.id));
  if (ids.size < 2) e.push('needs at least 2 sources');
  const tierOf = new Map((d.sources ?? []).map((s: any) => [s.id, s.tier]));
  const checkClaims = (claims: any[], where: string) => {
    for (const c of claims ?? []) {
      len(`${where} claim`, c.text, 600, 20);
      if (!KINDS.includes(c.kind)) e.push(`${where}: bad kind`);
      if (!Array.isArray(c.cite) || !c.cite.length || c.cite.some((x: string) => !ids.has(x))) e.push(`${where}: missing or unknown citation`);
      if (c.kind === 'fact' && !c.cite?.some((x: string) => tierOf.get(x) && tierOf.get(x) !== 'major-outlet')) e.push(`${where}: fact without primary source`);
      if ((c.kind === 'allegation' || c.kind === 'response') && !c.by) e.push(`${where}: no "by"`);
    }
  };
  if (!Array.isArray(d.timeline) || d.timeline.length < 3) e.push('needs 3+ timeline events');
  let prev = '';
  for (const [i, t] of (d.timeline ?? []).entries()) {
    if (!isDate(t.date)) e.push(`timeline[${i}] bad date`);
    else {
      if (t.date > today) e.push(`timeline[${i}] in the future`);
      if (prev && t.date < prev) e.push('timeline out of order');
      prev = t.date;
    }
    len(`timeline[${i}].headline`, t.headline, 90);
    if (!t.claims?.length) e.push(`timeline[${i}] has no claims`);
    checkClaims(t.claims, `timeline[${i}]`);
  }
  checkClaims(d.responses, 'responses');
  const hasAllegation = (d.timeline ?? []).some((t: any) => t.claims?.some((c: any) => c.kind === 'allegation'));
  if (hasAllegation && !(d.responses?.length) && !d.noResponseFound) e.push('allegation without response');
  if (d.next && (!isDate(d.next.date) || d.next.date < today || !d.next.label || d.next.label.length > 60)) e.push('bad next');
  const ruled = (d.status === 'resolved' || d.status === 'in-court') && (d.sources ?? []).some((s: any) => s.tier === 'court' || s.tier === 'official');
  for (const f of ['title', 'seoTitle', 'summary']) {
    const text = String(d[f] ?? '').toLowerCase();
    for (const w of VERDICT_WORDS) if (new RegExp(`\\b${w}\\b`).test(text) && !ruled) e.push(`${f} uses verdict word "${w}"`);
  }
  return e;
}
