// Checks the built site (run `npm run build` first): SEO tags, structured data, legal
// labels and feeds on real output, not on templates.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const DIST = path.resolve(import.meta.dirname, '..', 'dist');
const read = (p: string) => fs.readFileSync(path.join(DIST, p), 'utf8');
const exists = (p: string) => fs.existsSync(path.join(DIST, p));

function htmlFiles(dir = DIST): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'pagefind' || e.name === '_astro' ? [] : htmlFiles(p);
    return e.name.endsWith('.html') ? [p] : [];
  });
}

test('dist exists', () => assert.ok(exists('index.html'), 'run npm run build first'));

test('every page has one h1, a title, a description and a canonical', () => {
  for (const f of htmlFiles()) {
    const h = fs.readFileSync(f, 'utf8');
    const name = path.relative(DIST, f);
    assert.equal((h.match(/<h1[\s>]/g) ?? []).length, 1, `${name}: h1 count`);
    assert.match(h, /<title>[^<]{5,}<\/title>/, `${name}: title`);
    assert.match(h, /<meta name="description" content="[^"]{20,}"/, `${name}: description`);
    assert.match(h, /<link rel="canonical" href="https?:\/\/[^"]+\/"/, `${name}: canonical with trailing slash`);
  }
});

test('record pages carry NewsArticle + BreadcrumbList JSON-LD and no FAQ/ClaimReview', () => {
  const h = read('football/controversies/man-city-115-charges/index.html');
  const ld = JSON.parse(h.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)![1]);
  const types = ld['@graph'].map((n: { '@type': string }) => n['@type']);
  assert.ok(types.includes('NewsArticle'));
  assert.ok(types.includes('BreadcrumbList'));
  assert.ok(!types.includes('FAQPage') && !types.includes('ClaimReview'));
});

test('allegations are labelled and the other side is shown', () => {
  const h = read('entertainment/controversies/drake-umg-not-like-us-lawsuit/index.html');
  assert.match(h, /Claim by Drake/);
  assert.match(h, /The other side/);
  assert.match(h, /Response: Universal Music Group/);
});

test('every source chip opens a source sheet that exists', () => {
  for (const f of htmlFiles().filter((f) => f.includes('controversies'))) {
    const h = fs.readFileSync(f, 'utf8');
    for (const m of h.matchAll(/popovertarget="(src-[a-z0-9-]+)"/g)) assert.match(h, new RegExp(`id="${m[1]}" popover`), `${f}: ${m[1]}`);
  }
});

test('thin entity hubs are noindex and left out of the sitemap', () => {
  const thin = read('cricket/people/charlie-dean/index.html');
  assert.match(thin, /content="noindex, follow"/);
  const sitemap = read('sitemap.xml');
  assert.ok(!sitemap.includes('/charlie-dean/'));
  assert.ok(sitemap.includes('/football/controversies/man-city-115-charges/'));
});

test('share cards, feeds and AI map are generated', () => {
  assert.ok(exists('og/man-city-115-charges.png'));
  assert.ok(exists('og/man-city-115-charges-story.png'));
  assert.match(read('rss.xml'), /<item>/);
  assert.match(read('football/rss.xml'), /man-city-115-charges/);
  assert.match(read('llms.txt'), /## Cricket/);
  assert.match(read('robots.txt'), /Sitemap: /);
  assert.ok(exists('pagefind/pagefind-ui.js'), 'pagefind index missing');
});

test('record pages stay light on JavaScript (budget 60 KB)', () => {
  const h = read('football/controversies/man-city-115-charges/index.html');
  let bytes = [...h.matchAll(/<script(?![^>]*application\/ld\+json)[^>]*>([\s\S]*?)<\/script>/g)].reduce((n, m) => n + m[1].length, 0);
  for (const m of h.matchAll(/<script[^>]+src="(\/_astro\/[^"]+)"/g)) bytes += fs.statSync(path.join(DIST, m[1])).size;
  assert.ok(bytes < 60_000, `${bytes} bytes of JS`);
});
