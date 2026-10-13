// Share art rendered at build time (Satori -> SVG -> resvg -> PNG):
//   /og/<id>.png         1200x630  link previews (Search, Discover, X, WhatsApp)
//   /og/<id>-story.png   1080x1920 Instagram / WhatsApp story card, status and sources baked in
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { Resvg } from '@resvg/resvg-js';
import { BRAND, SITE_URL } from '../site';

const require = createRequire(import.meta.url);
// Satori's bundled yoga build reads __dirname when it detects Node; ESM has none, so
// provide one before loading it.
(globalThis as { __dirname?: string }).__dirname ??= path.join(path.dirname(require.resolve('satori/package.json')), 'dist');
const { default: satori } = await import('satori');
const font = (pkg: string, file: string) => fs.readFileSync(path.join(path.dirname(require.resolve(`${pkg}/package.json`)), 'files', file));
let fonts: Parameters<typeof satori>[1]['fonts'] | undefined;
const loadFonts = () =>
  (fonts ??= [
    { name: 'Unbounded', data: font('@fontsource/unbounded', 'unbounded-latin-800-normal.woff'), weight: 800, style: 'normal' },
    { name: 'Inter', data: font('@fontsource/inter', 'inter-latin-400-normal.woff'), weight: 400, style: 'normal' },
    { name: 'Inter', data: font('@fontsource/inter', 'inter-latin-600-normal.woff'), weight: 600, style: 'normal' },
    { name: 'Mono', data: font('@fontsource/jetbrains-mono', 'jetbrains-mono-latin-500-normal.woff'), weight: 500, style: 'normal' },
  ]);

export const C = {
  bg: '#0B0B10', card: '#14141C', line: '#2C2C3A', ink: '#F4F4F8', muted: '#A5A5B8', accent: '#B6FF3B',
  football: '#2EE59D', cricket: '#6EA4FF', entertainment: '#FF5FAE',
  ongoing: '#FFB020', 'in-court': '#B18CFF', resolved: '#3DDC84', disputed: '#FF7A59', 'insufficient-information': '#9A9AAE',
} as const;

type Node = { type: string; props: Record<string, unknown> };
export function h(type: string, style: Record<string, unknown>, ...children: (Node | string | false | null | undefined)[]): Node {
  const kids = children.filter((c) => c !== false && c !== null && c !== undefined);
  return { type, props: { style: { display: 'flex', ...style }, children: kids.length === 1 ? kids[0] : kids } };
}

const host = SITE_URL.replace(/^https?:\/\//, '');

const MARK = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path d="M7 3h18v24l-3-2-3 2-3-2-3 2-3-2-3 2z" fill="#B6FF3B"/><path d="M11.5 15.5l3 3 6-6.5" fill="none" stroke="#0B0B10" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>').toString('base64')}`;

function logo(size: number) {
  return h('div', { alignItems: 'center', gap: size * 0.3 },
    { type: 'img', props: { src: MARK, width: size, height: size } },
    h('div', { fontFamily: 'Unbounded', fontSize: size * 0.8, color: C.ink, letterSpacing: -1 }, BRAND.name.toLowerCase()),
  );
}

function pill(text: string, color: string, size: number) {
  return h('div', { alignItems: 'center', gap: size * 0.5, border: `2px solid ${color}`, color, borderRadius: 999, padding: `${size * 0.35}px ${size * 0.9}px`, fontFamily: 'Mono', fontSize: size },
    h('div', { width: size * 0.6, height: size * 0.6, borderRadius: 99, background: color }), text);
}

export interface CardData {
  title: string;
  kicker: string; // e.g. "⚽ FOOTBALL" (emoji-free in practice: Satori has no emoji font)
  accent: string;
  status?: { label: string; color: string };
  lines: string[];
  footer: string; // e.g. "5 sources · last verified 13 Oct 2026"
}

export function ogCard(d: CardData): Node {
  return h('div', { width: 1200, height: 630, background: C.bg, flexDirection: 'column', padding: 60, fontFamily: 'Inter', color: C.ink, position: 'relative' },
    h('div', { position: 'absolute', top: -160, right: -160, width: 520, height: 520, borderRadius: 999, background: d.accent, opacity: 0.18 }),
    h('div', { justifyContent: 'space-between', alignItems: 'center' },
      logo(44),
      d.status ? pill(d.status.label.toUpperCase(), d.status.color, 22) : false),
    h('div', { marginTop: 40, fontFamily: 'Mono', fontSize: 24, color: d.accent, letterSpacing: 3 }, d.kicker),
    h('div', { marginTop: 14, fontFamily: 'Unbounded', fontSize: d.title.length > 60 ? 52 : 60, lineHeight: 1.08, letterSpacing: -1.5 }, d.title),
    d.lines[0] ? h('div', { marginTop: 26, fontSize: 28, lineHeight: 1.35, color: C.muted, maxWidth: 1000 }, d.lines[0].length > 140 ? d.lines[0].slice(0, 139).replace(/\s+\S*$/, '') + '…' : d.lines[0]) : false,
    h('div', { marginTop: 'auto', justifyContent: 'space-between', alignItems: 'flex-end' },
      h('div', { fontFamily: 'Mono', fontSize: 22, color: C.muted }, d.footer),
      h('div', { fontFamily: 'Mono', fontSize: 22, color: C.accent }, host)),
  );
}

export function storyCard(d: CardData): Node {
  return h('div', { width: 1080, height: 1920, background: C.bg, flexDirection: 'column', padding: '110px 84px', fontFamily: 'Inter', color: C.ink, position: 'relative' },
    h('div', { position: 'absolute', top: -260, left: -200, width: 900, height: 900, borderRadius: 999, background: d.accent, opacity: 0.16 }),
    logo(60),
    h('div', { marginTop: 110, fontFamily: 'Mono', fontSize: 34, color: d.accent, letterSpacing: 4 }, d.kicker),
    h('div', { marginTop: 24, fontFamily: 'Unbounded', fontSize: d.title.length > 60 ? 72 : 84, lineHeight: 1.06, letterSpacing: -2 }, d.title),
    d.status ? h('div', { marginTop: 48 }, pill(d.status.label.toUpperCase(), d.status.color, 32)) : false,
    h('div', { marginTop: 64, flexDirection: 'column', gap: 30 },
      ...d.lines.map((l, i) =>
        h('div', { gap: 28, background: C.card, border: `2px solid ${C.line}`, borderRadius: 28, padding: '30px 34px' },
          h('div', { fontFamily: 'Unbounded', fontSize: 34, color: d.accent }, String(i + 1)),
          h('div', { fontSize: 36, lineHeight: 1.35, color: C.ink, flex: 1 }, l)))),
    h('div', { marginTop: 'auto', flexDirection: 'column', gap: 14 },
      h('div', { fontFamily: 'Mono', fontSize: 30, color: C.muted }, d.footer),
      h('div', { fontFamily: 'Unbounded', fontSize: 40, color: C.accent }, `Full receipts: ${host}`)),
  );
}

export async function png(node: Node, width: number, height: number) {
  const svg = await satori(node as never, { width, height, fonts: loadFonts() });
  return new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng();
}
