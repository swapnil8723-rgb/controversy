// Verticals, statuses, entity kinds and source tiers: the fixed vocabulary every
// page, chip and schema check shares.

export const VERTICALS = ['football', 'cricket', 'entertainment'] as const;
export type Vertical = (typeof VERTICALS)[number];

export const VERTICAL: Record<Vertical, { label: string; emoji: string; blurb: string; seo: string; h1: string }> = {
  football: {
    label: 'Football',
    emoji: '⚽',
    blurb: 'Financial charges, VAR calls, points deductions and governing-body rulings.',
    seo: "The latest football (soccer) controversies, fact-checked: rulings, appeals, FIFA and UEFA fights and match-day rows from the last 30 days.",
    h1: 'Football controversies',
  },
  cricket: {
    label: 'Cricket',
    emoji: '🏏',
    blurb: 'Laws, the spirit of cricket, board rulings and the dismissals everyone argued about.',
    seo: "The latest cricket controversies, fact-checked: board decisions, selection rows, ICC rulings and the disputes fans are arguing about this month.",
    h1: 'Cricket controversies',
  },
  entertainment: {
    label: 'Entertainment',
    emoji: '🎬',
    blurb: 'Film, music and streaming disputes backed by court records and on-record statements.',
    seo: "The latest entertainment controversies, fact-checked: music, film and celebrity lawsuits and disputes from the last 30 days, with both sides.",
    h1: 'Entertainment controversies',
  },
};

export const STATUSES = ['ongoing', 'in-court', 'resolved', 'disputed', 'insufficient-information'] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS: Record<Status, { label: string; long: string; cls: string }> = {
  ongoing: { label: 'Ongoing', long: 'Still developing: an official process or decision is pending.', cls: 'st-ongoing' },
  'in-court': { label: 'In court', long: 'Before a court, tribunal or appeal body; no final ruling yet.', cls: 'st-court' },
  resolved: { label: 'Resolved', long: 'A final decision, settlement or ruling closed the official process.', cls: 'st-resolved' },
  disputed: { label: 'Disputed', long: 'The facts are on record but the parties still dispute what they mean.', cls: 'st-disputed' },
  'insufficient-information': { label: 'Not enough info', long: 'There is not enough verified information to say where this stands.', cls: 'st-insufficient' },
};

export const ENTITY_KINDS = ['person', 'club', 'team', 'org', 'company', 'film'] as const;
export type EntityKind = (typeof ENTITY_KINDS)[number];
export const KIND_SEGMENT: Record<EntityKind, string> = {
  person: 'people',
  club: 'clubs',
  team: 'teams',
  org: 'orgs',
  company: 'companies',
  film: 'films',
};

export const TIERS = ['official', 'court', 'on-record', 'major-outlet'] as const;
export type Tier = (typeof TIERS)[number];
export const TIER: Record<Tier, { label: string; hint: string }> = {
  official: { label: 'Official', hint: 'A governing body, league, board or regulator speaking for itself.' },
  court: { label: 'Court', hint: 'A court, tribunal or arbitration record.' },
  'on-record': { label: 'On record', hint: 'A named party speaking publicly in their own words.' },
  'major-outlet': { label: 'Reported', hint: 'Reporting by an established news organisation.' },
};

// fact: established by an official, court or on-record source.
// reported: established by news reporting only, and labelled that way on the page.
// allegation / response: one party's claim, always attributed with `by`.
export const CLAIM_KINDS = ['fact', 'reported', 'allegation', 'response'] as const;
export type ClaimKind = (typeof CLAIM_KINDS)[number];

// Headline words that deliver a verdict. `npm run verify` allows them only on pages
// whose status is resolved or in-court and that cite a court or official source.
export const VERDICT_WORDS = ['exposed', 'scandal', 'guilty', 'liar', 'fraud', 'cheat', 'cheated', 'disgrace', 'shameful', 'destroyed', 'slammed', 'meltdown'];
