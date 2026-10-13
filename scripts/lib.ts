// Shared helpers for the content scripts: read Markdown frontmatter without Astro.
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';

export const ROOT = path.resolve(import.meta.dirname, '..');
export const CONTENT = path.join(ROOT, 'src', 'content');

export interface Source { id: string; name: string; title: string; url: string; archiveUrl?: string; published?: string; accessed: string; tier: string }
export interface Doc { file: string; slug: string; kind: 'records' | 'explainers' | 'entities'; data: Record<string, any>; body: string; raw: string }

export function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith('.md') ? [path.join(dir, e.name)] : []));
}

export function readDoc(file: string, kind: Doc['kind']): Doc {
  const raw = fs.readFileSync(file, 'utf8');
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) throw new Error(`${file}: missing frontmatter`);
  return { file, slug: path.basename(file, '.md'), kind, data: parse(m[1]) ?? {}, body: m[2], raw };
}

export function loadDocs() {
  const records = walk(path.join(CONTENT, 'records')).map((f) => readDoc(f, 'records'));
  const explainers = walk(path.join(CONTENT, 'explainers')).map((f) => readDoc(f, 'explainers'));
  const entities = walk(path.join(CONTENT, 'entities')).map((f) => readDoc(f, 'entities'));
  return { records, explainers, entities };
}

export const rel = (f: string) => path.relative(ROOT, f).replaceAll('\\', '/');
export const toDate = (v: unknown) => (v instanceof Date ? v : new Date(String(v)));
