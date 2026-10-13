// Search and AI answer engines are welcome: being cited by them is part of the plan.
import { abs } from '../site';

export function GET() {
  const body = `User-agent: *
Allow: /
Disallow: /search/

Sitemap: ${abs('/sitemap.xml')}
Sitemap: ${abs('/news-sitemap.xml')}
`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
