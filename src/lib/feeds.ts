// RSS items are record updates: one item per record, dated by its latest development.
import rss from '@astrojs/rss';
import { BRAND, SITE_URL } from '../site';
import { loadAll, recordUrl, lastEventDate } from './content';
import { VERTICAL, STATUS, type Vertical } from './taxonomy';

export async function recordsFeed(vertical?: Vertical) {
  const { records } = await loadAll();
  const items = records.filter((r) => !vertical || r.data.vertical === vertical);
  const label = vertical ? `${VERTICAL[vertical].label} · ` : '';
  return rss({
    title: `${BRAND.name}: ${label}latest controversy updates`,
    description: vertical ? VERTICAL[vertical].seo : BRAND.description,
    site: SITE_URL,
    trailingSlash: true,
    items: items.map((r) => {
      const last = r.data.timeline[r.data.timeline.length - 1];
      return {
        title: r.data.title,
        link: recordUrl(r),
        pubDate: lastEventDate(r),
        description: `${STATUS[r.data.status].label}: ${r.data.statusNote} Latest: ${last.headline}.`,
        categories: [VERTICAL[r.data.vertical].label, STATUS[r.data.status].label],
      };
    }),
    customData: '<language>en</language>',
  });
}
