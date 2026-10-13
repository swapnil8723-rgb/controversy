// Own sitemap so lastmod is the real "facts changed" date and thin hubs stay out.
import { loadAll, recordUrl, entityUrl, explainerUrl, recordsOfEntity, BUILD_TIME } from '../lib/content';
import { VERTICALS } from '../lib/taxonomy';
import { abs } from '../site';
import { iso } from '../lib/format';

export async function GET() {
  const { records, entities, explainers } = await loadAll();
  const newest = (ds: Date[]) => new Date(Math.max(...ds.map((d) => d.getTime())));
  const urls: { loc: string; lastmod: Date }[] = [];
  const allUpdated = records.map((r) => r.data.updated);
  urls.push({ loc: '/', lastmod: newest(allUpdated) });
  urls.push({ loc: '/latest/', lastmod: newest(allUpdated) });
  for (const v of VERTICALS) {
    const vr = records.filter((r) => r.data.vertical === v).map((r) => r.data.updated);
    if (!vr.length) continue;
    urls.push({ loc: `/${v}/`, lastmod: newest(vr) }, { loc: `/${v}/latest/`, lastmod: newest(vr) });
  }
  for (const r of records) urls.push({ loc: recordUrl(r), lastmod: r.data.updated });
  for (const x of explainers) urls.push({ loc: explainerUrl(x), lastmod: x.data.updated });
  for (const e of entities) {
    const recs = await recordsOfEntity(e);
    if (recs.length >= 2) urls.push({ loc: entityUrl(e), lastmod: newest(recs.map((r) => r.data.updated)) });
  }
  for (const p of ['/about/', '/editorial-policy/', '/corrections/', '/grievance/', '/contact/', '/privacy/']) urls.push({ loc: p, lastmod: BUILD_TIME });

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${abs(u.loc)}</loc><lastmod>${iso(u.lastmod)}</lastmod></url>`).join('\n')}
</urlset>
`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
