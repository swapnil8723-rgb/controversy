// Read and write content files: records, entities, archive and drafts.
import fs from 'node:fs';
import path from 'node:path';
import { parse, stringify } from 'yaml';

export const ROOT = path.resolve(import.meta.dirname, '..', '..');
export const RECORDS = path.join(ROOT, 'src', 'content', 'records');
export const ENTITIES = path.join(ROOT, 'src', 'content', 'entities');
export const ARCHIVE = path.join(ROOT, 'archive');
export const DRAFTS = path.join(ROOT, 'drafts');
export const STATE = path.join(ROOT, 'data', 'pipeline-state.json');

export interface Doc { file: string; slug: string; data: Record<string, any>; body: string }

export function readDoc(file: string): Doc {
  const raw = fs.readFileSync(file, 'utf8');
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) throw new Error(`${file}: no frontmatter`);
  return { file, slug: path.basename(file, '.md'), data: parse(m[1]) ?? {}, body: m[2] };
}

export function writeDoc(file: string, data: Record<string, any>, body = '') {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `---\n${stringify(data, { lineWidth: 0 })}---\n${body}`);
}

export function listRecords(): Doc[] {
  if (!fs.existsSync(RECORDS)) return [];
  return fs
    .readdirSync(RECORDS)
    .flatMap((v) => fs.readdirSync(path.join(RECORDS, v)).filter((f) => f.endsWith('.md')).map((f) => readDoc(path.join(RECORDS, v, f))));
}

export const entityExists = (slug: string) => fs.existsSync(path.join(ENTITIES, `${slug}.md`));

export function slugify(s: string, max = 70) {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/, '');
}

export function move(from: string, to: string) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.renameSync(from, to);
}

export interface State { seen: Record<string, string>; runs: number }
export function loadState(): State {
  try {
    return JSON.parse(fs.readFileSync(STATE, 'utf8'));
  } catch {
    return { seen: {}, runs: 0 };
  }
}
export function saveState(s: State, today: string) {
  // Forget URLs after 14 days so the file stays small.
  const cutoff = new Date(Date.parse(today) - 14 * 864e5).toISOString().slice(0, 10);
  for (const [u, d] of Object.entries(s.seen)) if (d < cutoff) delete s.seen[u];
  fs.mkdirSync(path.dirname(STATE), { recursive: true });
  fs.writeFileSync(STATE, JSON.stringify(s, null, 1) + '\n');
}

// Domains we treat as primary ("official") sources; everything else is reporting.
const OFFICIAL = /(^|\.)(gov\.uk|gov\.in|nic\.in|europa\.eu|premierleague\.com|thefa\.com|uefa\.com|fifa\.com|icc-cricket\.com|bcci\.tv|ecb\.co\.uk|cricket\.com\.au|sebi\.gov\.in|ofcom\.org\.uk|oscars\.org|supremecourt\.gov|uscourts\.gov|sci\.gov\.in)$/;
export const tierFor = (host: string) => (OFFICIAL.test(host) ? 'official' : 'major-outlet');
