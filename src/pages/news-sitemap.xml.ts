// Google News sitemap: only articles published or materially updated in the last 48 hours.
import { loadAll, recordUrl, BUILD_TIME } from '../lib/content';
import { BRAND, abs } from '../site';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function GET() {
  const { records } = await loadAll();
  const cutoff = BUILD_TIME.getTime() - 48 * 3600e3;
  const fresh = records.filter((r) => r.data.updated.getTime() >= cutoff);
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${fresh
  .map(
    (r) => `  <url>
    <loc>${abs(recordUrl(r))}</loc>
    <news:news>
      <news:publication><news:name>${esc(BRAND.name)}</news:name><news:language>en</news:language></news:publication>
      <news:publication_date>${r.data.updated.toISOString()}</news:publication_date>
      <news:title>${esc(r.data.title)}</news:title>
    </news:news>
  </url>`,
  )
  .join('\n')}
</urlset>
`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
