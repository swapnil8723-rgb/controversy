// Prompts and JSON schemas for the daily pipeline. The editorial rules here are the same
// ones the content schema and `npm run verify` enforce; the validator re-checks everything.

const CATS = ['football', 'cricket', 'entertainment', 'tech-ai', 'gaming', 'creators'];
const REGIONS = ['india', 'america', 'europe'];

const RULES = `Editorial rules (strict):
- Use ONLY facts stated in the numbered article texts you are given. Never add outside knowledge, guesses or context.
- Every claim cites the article numbers it comes from. Prefer claims supported by two articles.
- kind: "reported" for facts from reporting; "allegation" for one party's claim (set "by" to who claims it); "response" for the other side's reply (set "by"). Use "fact" only when an article quotes an official body, court or the party itself directly.
- If there is an allegation, include the other side's response when an article gives one; otherwise fill noResponseFound with a short honest note.
- Neutral, plain international English. No verdicts ("guilty", "fraud", "scandal", "cheat", "liar", "exposed", "disgrace") unless a court or official body has ruled, and then only quoting it.
- Never cover: rumours, private individuals, minors, sexual misconduct allegations, crimes not charged in court, deaths and tragedies, communal or religious disputes, partisan politics.
- Dates as YYYY-MM-DD. Use dateLabel ("Sep 2026") when only the month is known. Timeline in date order, nothing in the future.`;

export const TRIAGE_SYSTEM = `You are the news desk of Lorecheck, a site of fact-checked controversy timelines for a Gen Z audience in India, America and Europe.
Categories: ${CATS.join(', ')}. Regions: ${REGIONS.join(', ')}.
You get numbered headlines from the last day and the list of stories we already cover.
Group headlines about the same story. For each group decide:
- is it a genuine public controversy (a dispute, ruling, lawsuit, ban, backlash or official action) in one of our categories?
- which existing story it updates (existingId), if any;
- regions where it matters most (1 or 2);
- risk: "low" (official decisions, lawsuits between companies, sports rulings), "medium" (allegations against named people), "high" (anything in the never-cover list below);
- worth: 1 to 10 for how many of our readers will search for it.
Never cover: rumours, private individuals, minors, sexual misconduct allegations, crimes not charged in court, deaths and tragedies, communal or religious disputes, partisan politics. Mark those risk "high".`;

export const TRIAGE_SCHEMA = {
  type: 'object',
  properties: {
    stories: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          items: { type: 'array', items: { type: 'integer' } },
          headline: { type: 'string' },
          category: { type: 'string', enum: CATS },
          regions: { type: 'array', items: { type: 'string', enum: REGIONS } },
          existingId: { type: 'string' },
          risk: { type: 'string', enum: ['low', 'medium', 'high'] },
          worth: { type: 'integer' },
        },
        required: ['items', 'headline', 'category', 'regions', 'risk', 'worth'],
      },
    },
  },
  required: ['stories'],
};

const claim = {
  type: 'object',
  properties: {
    text: { type: 'string' },
    kind: { type: 'string', enum: ['fact', 'reported', 'allegation', 'response'] },
    by: { type: 'string' },
    cite: { type: 'array', items: { type: 'integer' } },
  },
  required: ['text', 'kind', 'cite'],
};
const event = {
  type: 'object',
  properties: { date: { type: 'string' }, dateLabel: { type: 'string' }, headline: { type: 'string' }, claims: { type: 'array', items: claim } },
  required: ['date', 'headline', 'claims'],
};

export const DRAFT_SYSTEM = `You write one controversy record for Lorecheck from the numbered articles provided.
${RULES}
Length limits: title <= 70 chars, seoTitle <= 60, tag <= 20 (2-3 words), summary <= 160, each tldr line <= 200 (exactly 3 lines), statusNote <= 220, timeline headline <= 90, next.label <= 60.
At least 3 timeline events. status is one of: ongoing, in-court, resolved, disputed, insufficient-information.
entities: 1 to 3 public people or organisations at the centre of the story, each with a neutral one-sentence bio of 60 to 300 chars using only facts from the articles.
Set "skip": true (and nothing else) if the articles do not support a fair, sourced record under these rules.`;

export const DRAFT_SCHEMA = {
  type: 'object',
  properties: {
    skip: { type: 'boolean' },
    title: { type: 'string' },
    seoTitle: { type: 'string' },
    tag: { type: 'string' },
    summary: { type: 'string' },
    tldr: { type: 'array', items: { type: 'string' } },
    status: { type: 'string', enum: ['ongoing', 'in-court', 'resolved', 'disputed', 'insufficient-information'] },
    statusNote: { type: 'string' },
    keywords: { type: 'array', items: { type: 'string' } },
    keyFacts: { type: 'array', items: { type: 'object', properties: { label: { type: 'string' }, value: { type: 'string' } }, required: ['label', 'value'] } },
    entities: {
      type: 'array',
      items: {
        type: 'object',
        properties: { name: { type: 'string' }, kind: { type: 'string', enum: ['person', 'club', 'team', 'org', 'company', 'film'] }, role: { type: 'string' }, bio: { type: 'string' } },
        required: ['name', 'kind', 'role', 'bio'],
      },
    },
    timeline: { type: 'array', items: event },
    responses: { type: 'array', items: claim },
    noResponseFound: { type: 'string' },
    next: { type: 'object', properties: { date: { type: 'string' }, label: { type: 'string' } }, required: ['date', 'label'] },
  },
  required: ['skip'],
};

export const UPDATE_SYSTEM = `You maintain an existing Lorecheck controversy record. You get the record's current state and new numbered articles.
Decide whether the articles report a genuinely new development that happened after the record's latest event. If not, set "newDevelopment": false.
If yes, write one new timeline event citing the new articles, and update status, statusNote and next only if the articles say so.
${RULES}
Limits: headline <= 90 chars, statusNote <= 220, next.label <= 60.`;

export const UPDATE_SCHEMA = {
  type: 'object',
  properties: {
    newDevelopment: { type: 'boolean' },
    event,
    status: { type: 'string', enum: ['ongoing', 'in-court', 'resolved', 'disputed', 'insufficient-information'] },
    statusNote: { type: 'string' },
    next: { type: 'object', properties: { date: { type: 'string' }, label: { type: 'string' } }, required: ['date', 'label'] },
    responses: { type: 'array', items: claim },
  },
  required: ['newDevelopment'],
};

export function articlesBlock(pages: { outlet: string; title: string; publishedAt?: string; text: string }[], offset = 1) {
  return pages
    .map((p, i) => `[${i + offset}] ${p.outlet} | ${p.publishedAt?.slice(0, 10) ?? 'date unknown'} | ${p.title}\n${p.text}`)
    .join('\n\n---\n\n');
}
