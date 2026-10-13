// Unit tests for the daily pipeline's parsing and safety checks (no network, no AI).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFeed, CONTROVERSY } from '../scripts/pipeline/sources.ts';
import { validateRecord } from '../scripts/pipeline/validate.ts';
import { slugify } from '../scripts/pipeline/store.ts';

const TODAY = '2026-10-13';
const good = () => ({
  title: 'Club fined after mass confrontation',
  tag: 'Club fined',
  summary: 'The league fined a club after a mass confrontation during a match.',
  tldr: ['The league fined the club.', 'The coach was fined too.', 'Nobody was suspended.'],
  vertical: 'football',
  regions: ['europe'],
  status: 'resolved',
  statusNote: 'Fines issued; no suspensions.',
  riskTier: 'low',
  sources: [
    { id: 's1', name: 'a.com', title: 'A', url: 'https://a.com/x', accessed: TODAY, tier: 'major-outlet' },
    { id: 's2', name: 'b.com', title: 'B', url: 'https://b.com/y', accessed: TODAY, tier: 'major-outlet' },
  ],
  timeline: [
    { date: '2026-10-01', headline: 'Match', claims: [{ text: 'The match ended in a mass confrontation.', kind: 'reported', cite: ['s1'] }] },
    { date: '2026-10-02', headline: 'Charge', claims: [{ text: 'The league charged the club with misconduct.', kind: 'reported', cite: ['s1', 's2'] }] },
    { date: '2026-10-05', headline: 'Fine', claims: [{ text: 'The league fined the club and its coach.', kind: 'reported', cite: ['s2'] }] },
  ],
  responses: [],
});

test('a well-formed draft passes', () => assert.deepEqual(validateRecord(good(), TODAY), []));

test('drafts that break editorial rules are rejected', () => {
  const unsourced = good();
  unsourced.timeline[0].claims[0].cite = [];
  assert.ok(validateRecord(unsourced, TODAY).some((e) => e.includes('citation')));

  const oneSource = good();
  oneSource.sources = oneSource.sources.slice(0, 1);
  assert.ok(validateRecord(oneSource, TODAY).some((e) => e.includes('2 sources')));

  const verdict = good();
  verdict.title = 'Coach exposed as a cheat';
  verdict.status = 'disputed';
  assert.ok(validateRecord(verdict, TODAY).some((e) => e.includes('verdict')));

  const allegation: any = good();
  allegation.timeline[1].claims[0] = { text: 'A player alleges the referee was biased.', kind: 'allegation', by: 'Player', cite: ['s1'] };
  assert.ok(validateRecord(allegation, TODAY).some((e) => e.includes('without response')));

  const future = good();
  future.timeline[2].date = '2026-12-01';
  assert.ok(validateRecord(future, TODAY).some((e) => e.includes('future')));

  const factNoPrimary: any = good();
  factNoPrimary.timeline[0].claims[0].kind = 'fact';
  assert.ok(validateRecord(factNoPrimary, TODAY).some((e) => e.includes('primary')));
});

test('RSS and Atom feeds parse', () => {
  const rss = `<rss><channel><item><title>Club fined after row</title><link>https://a.com/1</link><pubDate>Mon, 12 Oct 2026 10:00:00 GMT</pubDate><description><![CDATA[<p>The league acted.</p>]]></description></item></channel></rss>`;
  const atom = `<feed><entry><title>Studio sued</title><link href="https://b.com/2"/><updated>2026-10-12T09:00:00Z</updated><summary>Lawsuit filed.</summary></entry></feed>`;
  const [r] = parseFeed(rss, 'football');
  assert.equal(r.url, 'https://a.com/1');
  assert.equal(r.description, 'The league acted.');
  assert.equal(r.publishedAt, '2026-10-12T10:00:00.000Z');
  const [a] = parseFeed(atom, 'gaming');
  assert.equal(a.url, 'https://b.com/2');
});

test('dispute vocabulary filter', () => {
  assert.ok(CONTROVERSY.test('Singer sues label over royalties'));
  assert.ok(CONTROVERSY.test('Regulator fines platform'));
  assert.ok(!CONTROVERSY.test('Ten best songs of the summer'));
});

test('slugify', () => assert.equal(slugify('Vinícius Júnior: red card & ban!'), 'vinicius-junior-red-card-ban'));
