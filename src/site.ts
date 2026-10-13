// One place for brand and origin. Set SITE_URL in the deploy environment; it defaults to
// the chosen domain.
export const SITE_URL = (import.meta.env.SITE as string | undefined)?.replace(/\/$/, '') || 'https://lorecheck.co';

export const BRAND = {
  name: 'Lorecheck',
  tagline: 'The full lore. Fact-checked.',
  description:
    "This month's biggest football, cricket and entertainment controversies, fact-checked: what happened, what's proven, what's only alleged, and where it stands now.",
  handle: '@lorecheck',
  email: 'hello@lorecheck.co',
  grievanceEmail: 'grievance@lorecheck.co',
  locale: 'en',
  // Audience: India, US, UK and Europe, Australia, New Zealand. Dates use "13 Oct 2026"
  // so they read the same everywhere; football is also called soccer for US readers.
} as const;

export const abs = (path: string) => new URL(path, SITE_URL + '/').toString();
