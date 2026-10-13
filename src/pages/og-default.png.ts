import { C, ogCard, png } from '../lib/cards';
import { BRAND } from '../site';

export async function GET() {
  const body = await png(
    ogCard({ title: "What's the lore? This month's controversies, fact-checked.", label: 'FOOTBALL · CRICKET · ENTERTAINMENT', accent: C.accent, lines: [], footer: BRAND.tagline }),
    1200,
    630,
  );
  return new Response(new Uint8Array(body), { headers: { 'Content-Type': 'image/png' } });
}
