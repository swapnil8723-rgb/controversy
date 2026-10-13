// Structured data. Article + BreadcrumbList + Organization only: Google no longer shows
// FAQ or ClaimReview rich results, so the plan does not depend on them.
import { BRAND, SITE_URL, abs } from '../site';
import { isoFull } from './format';

export const ORG_ID = `${SITE_URL}/#org`;

export function organization() {
  return {
    '@type': 'NewsMediaOrganization',
    '@id': ORG_ID,
    name: BRAND.name,
    url: SITE_URL + '/',
    logo: { '@type': 'ImageObject', url: abs('/icon-512.png'), width: 512, height: 512 },
    publishingPrinciples: abs('/editorial-policy/'),
    correctionsPolicy: abs('/corrections/'),
    verificationFactCheckingPolicy: abs('/editorial-policy/'),
    actionableFeedbackPolicy: abs('/contact/'),
    ethicsPolicy: abs('/editorial-policy/'),
  };
}

export function website() {
  return {
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    url: SITE_URL + '/',
    name: BRAND.name,
    description: BRAND.description,
    inLanguage: 'en',
    publisher: { '@id': ORG_ID },
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/search/?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function breadcrumbs(items: { name: string; url: string }[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: abs(it.url) })),
  };
}

export function article(o: {
  url: string;
  headline: string;
  description: string;
  image: string;
  published: Date;
  modified: Date;
  section: string;
  keywords?: string[];
  about?: { name: string; sameAs: string[]; type: string }[];
  citations?: string[];
}) {
  return {
    '@type': 'NewsArticle',
    '@id': abs(o.url) + '#article',
    mainEntityOfPage: abs(o.url),
    headline: o.headline,
    description: o.description,
    image: [abs(o.image)],
    datePublished: isoFull(o.published),
    dateModified: isoFull(o.modified),
    articleSection: o.section,
    inLanguage: 'en',
    keywords: o.keywords?.join(', '),
    author: { '@type': 'Organization', name: `${BRAND.name} editorial desk`, url: abs('/about/') },
    publisher: { '@id': ORG_ID },
    isAccessibleForFree: true,
    about: o.about?.map((a) => ({ '@type': a.type, name: a.name, sameAs: a.sameAs })),
    citation: o.citations,
  };
}

export const graph = (...nodes: object[]) => ({ '@context': 'https://schema.org', '@graph': nodes });
