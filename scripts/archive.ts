// Fill in `archiveUrl` for sources that lack one, using the Wayback Machine.
//
//   npm run archive            look up the closest existing snapshot (read-only)
//   npm run archive -- --save  also ask the Wayback Machine to take a new snapshot when
//                              none exists (creates a public archive copy)
//
// Edits the Markdown files in place, adding the archiveUrl line under each source's url.
import fs from 'node:fs';
import { loadDocs, rel, type Source } from './lib.ts';

const save = process.argv.includes('--save');
const UA = 'receipts-archive/1.0 (+editorial source archiving)';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// The availability API rate-limits bursts: space requests out and back off on 429.
async function closest(url: string, accessed: string) {
  const ts = String(accessed).slice(0, 10).replaceAll('-', '');
  let res: Response | undefined;
  for (let attempt = 0; attempt < 4; attempt++) {
    await sleep(attempt === 0 ? 1500 : 15000 * attempt);
    res = await fetch(`https://archive.org/wayback/available?url=${encodeURIComponent(url)}&timestamp=${ts}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) });
    if (res.status !== 429) break;
    console.log('rate limited by archive.org, backing off…');
  }
  if (!res?.ok) throw new Error(`availability API ${res?.status}`);
  const j = (await res.json()) as { archived_snapshots?: { closest?: { available: boolean; url: string } } };
  const c = j.archived_snapshots?.closest;
  return c?.available ? c.url.replace(/^http:/, 'https:') : undefined;
}

async function snapshot(url: string) {
  const res = await fetch(`https://web.archive.org/save/${url}`, { headers: { 'User-Agent': UA }, redirect: 'manual', signal: AbortSignal.timeout(120000) });
  const loc = res.headers.get('location') ?? res.headers.get('content-location');
  return loc ? new URL(loc, 'https://web.archive.org').toString() : undefined;
}

const { records, explainers } = loadDocs();
let added = 0;
let missing = 0;
for (const d of [...records, ...explainers]) {
  let raw = d.raw;
  for (const s of (d.data.sources ?? []) as Source[]) {
    if (s.archiveUrl) continue;
    let a = await closest(s.url, s.accessed).catch((e) => void console.log(`error ${s.id}: ${(e as Error).message}`));
    if (!a && save) a = await snapshot(s.url).catch(() => undefined);
    if (!a) {
      missing++;
      console.log(`none  ${rel(d.file)} · ${s.id}`);
      continue;
    }
    const line = `    url: "${s.url}"`;
    if (!raw.includes(line)) continue;
    raw = raw.replace(line, `${line}\n    archiveUrl: "${a}"`);
    added++;
    console.log(`added ${rel(d.file)} · ${s.id} → ${a}`);
  }
  if (raw !== d.raw) fs.writeFileSync(d.file, raw);
}
console.log(`\n${added} archive links added, ${missing} sources still without a snapshot${save ? '' : ' (re-run with --save to create them)'}`);
