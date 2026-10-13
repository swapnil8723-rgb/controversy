// Discovery and reading: free publisher RSS feeds (no API keys), then the article pages
// themselves, so every claim the AI writes can be checked against text we actually fetched.

export interface FeedItem { url: string; title: string; description: string; publishedAt?: string; outlet: string; hint: string }
export interface Page { url: string; outlet: string; title: string; publishedAt?: string; text: string }

// Feed URL -> topic hint. A failing feed is logged and skipped, never fatal.
export const FEEDS: Record<string, string> = {
  'https://feeds.bbci.co.uk/sport/football/rss.xml': 'football',
  'https://www.theguardian.com/football/rss': 'football',
  'https://www.espn.com/espn/rss/soccer/news': 'football',
  'https://www.skysports.com/rss/12040': 'football',
  'https://feeds.bbci.co.uk/sport/cricket/rss.xml': 'cricket',
  'https://www.espncricinfo.com/rss/content/story/feeds/0.xml': 'cricket',
  'https://www.thehindu.com/sport/cricket/feeder/default.rss': 'cricket',
  'https://indianexpress.com/section/sports/cricket/feed/': 'cricket',
  'https://variety.com/feed/': 'entertainment',
  'https://www.hollywoodreporter.com/feed/': 'entertainment',
  'https://www.billboard.com/feed/': 'entertainment',
  'https://www.theguardian.com/culture/rss': 'entertainment',
  'https://indianexpress.com/section/entertainment/feed/': 'entertainment',
  'https://www.hindustantimes.com/feeds/rss/entertainment/rssfeed.xml': 'entertainment',
  'https://techcrunch.com/feed/': 'tech-ai',
  'https://www.theverge.com/rss/index.xml': 'tech-ai',
  'https://feeds.arstechnica.com/arstechnica/index': 'tech-ai',
  'https://www.theguardian.com/uk/technology/rss': 'tech-ai',
  'https://www.medianama.com/feed/': 'tech-ai',
  'https://www.gamesindustry.biz/feed': 'gaming',
  'https://www.gamedeveloper.com/rss.xml': 'gaming',
  'https://www.eurogamer.net/feed': 'gaming',
  'https://www.pcgamer.com/rss/': 'gaming',
  'https://www.tubefilter.com/feed/': 'creators',
  'https://www.dexerto.com/feed/': 'creators',
  'https://www.socialmediatoday.com/feeds/news/': 'creators',
};

// Only headlines that read like a dispute get past discovery.
export const CONTROVERSY = /\b(controvers|row|rows|backlash|outrage|lawsuit|sues?|sued|suing|court|tribunal|judge|ruling|appeal|ban(s|ned)?|suspend|fine[ds]?|charged|accus|alleg|probe|investigat|dispute|boycott|criticis|criticiz|apolog|complaint|deepfake|copyright|infring|regulator|sanction|penalt|walkout|strike|scrap|reverse|deduct|disciplin)/i;

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';
const NAMED: Record<string, string> = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', ndash: '–', mdash: '—', hellip: '…', pound: '£', euro: '€', rupee: '₹' };
const entities = (s: string) =>
  s
    .replace(/&([a-z]+);/gi, (m, n) => NAMED[n.toLowerCase()] ?? m)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
export const decode = (s: string) => entities(entities(s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, ' '))).replace(/\s+/g, ' ').trim();

export const outletOf = (url: string) => new URL(url).hostname.replace(/^(www|feeds|en)\./, '');

export function parseFeed(xml: string, hint: string): FeedItem[] {
  const items: FeedItem[] = [];
  for (const m of xml.matchAll(/<(item|entry)[\s>][\s\S]*?<\/\1>/g)) {
    const b = m[0];
    const tag = (t: string) => b.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`))?.[1] ?? '';
    const atomLink = b.match(/<link[^>]+href=["']([^"']+)["']/)?.[1] ?? '';
    const url = (decode(tag('link')) || atomLink || decode(tag('guid'))).trim();
    if (!/^https?:\/\//.test(url)) continue;
    const pub = decode(tag('pubDate') || tag('published') || tag('updated') || tag('dc:date'));
    const t = pub ? Date.parse(pub) : NaN;
    items.push({ url, title: decode(tag('title')), description: decode(tag('description') || tag('summary')).slice(0, 300), publishedAt: Number.isFinite(t) ? new Date(t).toISOString() : undefined, outlet: outletOf(url), hint });
  }
  return items;
}

export async function discover(maxAgeHours: number, log: (s: string) => void) {
  const out: FeedItem[] = [];
  const entries = Object.entries(FEEDS);
  await Promise.all(
    entries.map(async ([feed, hint]) => {
      try {
        const res = await fetch(feed, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(20000) });
        if (!res.ok) throw new Error(String(res.status));
        const items = parseFeed(await res.text(), hint).filter(
          (i) => CONTROVERSY.test(`${i.title} ${i.description}`) && (!i.publishedAt || Date.now() - Date.parse(i.publishedAt) < maxAgeHours * 3.6e6),
        );
        out.push(...items);
      } catch (e) {
        log(`feed ${outletOf(feed)}: ${(e as Error).message}`);
      }
    }),
  );
  const seen = new Set<string>();
  return out.filter((i) => (seen.has(i.url) ? false : (seen.add(i.url), true)));
}

const JUNK = /subscribe|newsletter|cookie|all rights reserved|copyright ©|sign up|log ?in|download (the )?app|follow us|also read|read more|click here|advertisement/i;
const meta = (html: string, key: string) => {
  const tag = html.match(new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${key}["'][^>]*>`, 'i'))?.[0];
  return tag ? decode(tag.match(/content=["']([^"']*)["']/i)?.[1] ?? '') : '';
};

/** Fetch an article and keep only its readable text (in memory; never stored). */
export async function readPage(url: string): Promise<Page | undefined> {
  try {
    const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html' }, redirect: 'follow', signal: AbortSignal.timeout(15000) });
    if (!res.ok || !/html/i.test(res.headers.get('content-type') || '')) return undefined;
    const html = (await res.text()).slice(0, 2_000_000);
    let text = '';
    for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
      try {
        const j = JSON.parse(m[1].trim());
        const all = Array.isArray(j) ? j : j['@graph'] ?? [j];
        const art = all.find((x: any) => /Article|Report/i.test(String(x?.['@type'])));
        if (typeof art?.articleBody === 'string') text = decode(art.articleBody);
      } catch {
        /* malformed JSON-LD is common */
      }
    }
    if (text.length < 400) {
      const body = html.replace(/<(script|style|noscript|svg|nav|footer|header|aside|form)[\s\S]*?<\/\1>/gi, ' ');
      const scope = body.match(/<article[\s>][\s\S]*<\/article>/i)?.[0] ?? body;
      const paras = [...scope.matchAll(/<p[\s>][\s\S]*?<\/p>/gi)].map((m) => decode(m[0])).filter((p) => p.length > 50 && !JUNK.test(p));
      const joined = [...new Set(paras)].join('\n');
      if (joined.length > text.length) text = joined;
    }
    if (text.length < 300) return undefined;
    const pub = meta(html, 'article:published_time') || html.match(/"datePublished"\s*:\s*"([^"]+)"/)?.[1] || '';
    const t = pub ? Date.parse(pub) : NaN;
    const finalUrl = res.url || url;
    return { url: finalUrl, outlet: outletOf(finalUrl), title: (meta(html, 'og:title') || decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '')).slice(0, 200), publishedAt: Number.isFinite(t) ? new Date(t).toISOString() : undefined, text: text.slice(0, 6000) };
  } catch {
    return undefined;
  }
}
