// Content access, URLs and derived values (heat, entity links) shared by every page.
import { getCollection, type CollectionEntry } from 'astro:content';
import { KIND_SEGMENT, type Vertical, type Region } from './taxonomy';

export type Rec = CollectionEntry<'records'>;
export type Ent = CollectionEntry<'entities'>;
export type Exp = CollectionEntry<'explainers'>;

export const recordUrl = (r: Rec) => `/${r.data.vertical}/controversies/${r.id}/`;
export const entityUrl = (e: Ent) => `/${e.data.vertical}/${KIND_SEGMENT[e.data.kind]}/${e.id}/`;
export const explainerUrl = (x: Exp) => `/${x.data.vertical}/explained/${x.id}/`;
export const verticalUrl = (v: Vertical) => `/${v}/`;
export const regionUrl = (r: Region) => `/${r}/`;

// Build time is "now" for every page in one build, so heat is stable within a deploy.
export const BUILD_TIME = new Date();

const byUpdated = (a: { data: { updated: Date } }, b: { data: { updated: Date } }) => b.data.updated.getTime() - a.data.updated.getTime();

/** Most recent dated event in a record, used for "latest" ordering. */
export const lastEventDate = (r: Rec) => r.data.timeline[r.data.timeline.length - 1].date;

let cache: { records: Rec[]; entities: Ent[]; explainers: Exp[] } | undefined;
export async function loadAll() {
  if (cache) return cache;
  const [records, entities, explainers] = await Promise.all([getCollection('records'), getCollection('entities'), getCollection('explainers')]);
  records.sort((a, b) => lastEventDate(b).getTime() - lastEventDate(a).getTime());
  explainers.sort(byUpdated);
  cache = { records, entities, explainers };
  return cache;
}

export async function entitiesOf(r: Rec) {
  const { entities } = await loadAll();
  return r.data.entities.map((ref) => entities.find((e) => e.id === ref.id)).filter((e): e is Ent => !!e);
}

export async function recordsOfEntity(e: Ent) {
  const { records } = await loadAll();
  return records.filter((r) => r.data.entities.some((ref) => ref.id === e.id));
}

/** Entity hubs with fewer than two records are thin: they stay linkable but are noindex. */
export async function isThinHub(e: Ent) {
  return (await recordsOfEntity(e)).length < 2;
}

/** Days since the record's latest dated development (0 = today). */
export const ageDays = (r: Rec, now = BUILD_TIME) => Math.max(0, Math.floor((now.getTime() - lastEventDate(r).getTime()) / 864e5));

/** The freshness window the site is built around: stories whose latest development is within it. */
export const FRESH_DAYS = 30;
export const isNew = (r: Rec) => ageDays(r) <= 3;

/** Short relative age for pills: "today", "2d ago", "3w ago". */
export function shortAgo(days: number) {
  if (days < 1) return 'today';
  if (days < 14) return `${days}d ago`;
  if (days < 60) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30.44)}mo ago`;
}

/** Upcoming "what's next" dates across records, soonest first. */
export async function upcoming(now = BUILD_TIME) {
  const { records } = await loadAll();
  const today = new Date(now.toISOString().slice(0, 10));
  return records
    .filter((r) => r.data.next && r.data.next.date >= today)
    .map((r) => ({ r, ...r.data.next! }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

/** Source lookup for a record or explainer. */
export function sourceMap<T extends { id: string }>(sources: T[]) {
  return new Map(sources.map((s) => [s.id, s]));
}
