import type { APIRoute } from 'astro';
import { loadAll } from '../../lib/content';
import { C, ogCard, storyCard, png, type CardData } from '../../lib/cards';
import { STATUS, VERTICAL } from '../../lib/taxonomy';
import { day, clip } from '../../lib/format';

export async function getStaticPaths() {
  const { records, explainers } = await loadAll();
  const out: { params: { name: string }; props: { data: CardData; story: boolean } }[] = [];
  for (const r of records) {
    const d = r.data;
    const data: CardData = {
      title: d.title,
      label: VERTICAL[d.vertical].label.toUpperCase(),
      accent: C[d.vertical],
      status: { label: STATUS[d.status].label, color: C[d.status] },
      lines: d.tldr.map((t) => clip(t, 175)),
      footer: `${d.sources.length} sources · verified ${day(d.lastVerified)}`,
    };
    out.push({ params: { name: r.id }, props: { data, story: false } }, { params: { name: `${r.id}-story` }, props: { data, story: true } });
  }
  for (const x of explainers) {
    const d = x.data;
    out.push({
      params: { name: x.id },
      props: { story: false, data: { title: d.title, label: `${VERTICAL[d.vertical].label.toUpperCase()} · EXPLAINED`, accent: C[d.vertical], lines: [], footer: `${d.sources.length} sources · updated ${day(d.updated)}` } },
    });
  }
  return out;
}

export const GET: APIRoute = async ({ props }) => {
  const { data, story } = props as { data: CardData; story: boolean };
  const body = story ? await png(storyCard(data), 1080, 1920) : await png(ogCard(data), 1200, 630);
  return new Response(new Uint8Array(body), { headers: { 'Content-Type': 'image/png' } });
};
