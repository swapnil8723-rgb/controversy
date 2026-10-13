// Content access, URLs and derived values (heat, entity links) shared by every page.
import { getCollection, type CollectionEntry } from 'astro:content';
import { KIND_SEGMENT, type Vertical } from './taxonomy';

export type Rec = CollectionEntry<'records'>;
export type Ent = CollectionEntry<'entities'>;
export type Exp = CollectionEntry<'explainers'>;

export const recordUrl = (r: Rec) => `/${r.data.vertical}/controversies/${r.id}/`;
export const entityUrl = (e: Ent) => `/${e.data.vertical}/${KIND_SEGMENT[e.data.kind]}/${e.id}/`;
export const explainerUrl = (x: Exp) => `/${x.data.vertical}/explained/${x.id}/`;
export const verticalUrl = (v: Vertical) => `/${v}/`;

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

export type Heat = 'hot' | 'warm' | 'cool';
/**
 * Attention level from the record's own dated events, never an editorial opinion:
 * hot = an official development in the last 30 days; warm = one in the last 180 days
 * or the case is still open; cool = everything else.
 */
export function heatOf(r: Rec, now = BUILD_TIME): Heat {
  const days = (now.getTime() - lastEventDate(r).getTime()) / 864e5;
  if (days <= 30) return 'hot';
  if (days <= 180 || r.data.status === 'ongoing' || r.data.status === 'in-court') return 'warm';
  return 'cool';
}

export const HEAT_LABEL: Record<Heat, string> = { hot: 'Heating up', warm: 'Simmering', cool: 'Cooled off' };

/** Source lookup for a record or explainer. */
export function sourceMap<T extends { id: string }>(sources: T[]) {
  return new Map(sources.map((s) => [s.id, s]));
}
