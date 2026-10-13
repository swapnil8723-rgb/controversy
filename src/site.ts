// One place for brand and origin. The brand is a working name until the domain is
// chosen: change NAME/HANDLE here and set SITE_URL in the deploy environment.
export const SITE_URL = (import.meta.env.SITE as string | undefined)?.replace(/\/$/, '') || 'https://receipts.example';

export const BRAND = {
  name: 'Receipts',
  tagline: 'Controversies, with the receipts.',
  description:
    'Sourced timelines of the biggest football, cricket and entertainment controversies: what happened, what is proven, what is alleged, and where it stands now.',
  handle: '@receipts',
  email: 'hello@receipts.example',
  grievanceEmail: 'grievance@receipts.example',
  locale: 'en',
  // Audience: India, US, UK and Europe, Australia, New Zealand. Dates use "13 Oct 2026"
  // so they read the same everywhere; football is also called soccer for US readers.
} as const;

export const abs = (path: string) => new URL(path, SITE_URL + '/').toString();
