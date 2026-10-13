# Lorecheck: the full lore, fact-checked (lorecheck.co)

Sourced, neutral timelines of **this month's** controversies in six categories (Football, Cricket, Entertainment, Tech & AI, Gaming, Creators) across three regions (India, America, Europe) for a Gen Z audience in India, the US, the UK and Europe, Australia and New Zealand. Built from `Plan v1 (superseded).docx` (the "Controversy Tracker: Phase 1 Plan").

Astro 7.3 (static) + Tailwind 4, Pagefind search, share cards rendered at build with Satori. No database and no server.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Local dev server (search works only after a build) |
| `npm run build` | Build to `dist/`: content schema gate, pages, share cards, search index |
| `npm run preview` | Serve `dist/` |
| `npm test` | Tests against the built output (SEO tags, JSON-LD, labels, JS budget) |
| `npm run verify` | Editorial gates: verdict words, stale open cases, broken references |
| `npm run verify:strict` | Launch mode: also fails on drafts and missing archive links |
| `npm run verify:links` | Also requests every source URL (404/410 fail) |
| `npm run archive` | Adds Wayback Machine links for sources (`-- --save` creates snapshots) |
| `node scripts/shot.ts shots 390 / …` | Screenshots + horizontal-overflow check (preview must be running) |

The brand and origin live in `src/site.ts` (default `https://lorecheck.co`; override with `SITE_URL`).

## Freshness rule

The site covers controversies with a verified development in the last 30 days. `npm run verify` warns when a story has had no new development for 30 days, or when its `next` date has passed. Quiet stories move to `archive/` (kept, not published) and come back if something new happens.

## Daily auto-update (free)

`.github/workflows/daily.yml` runs every day at 06:00 IST on GitHub Actions:

1. Archives stories with no development for 30 days and nothing scheduled in the next 30; clears passed dates.
2. Reads free publisher RSS feeds (`scripts/pipeline/sources.ts`) for dispute headlines from the last 36 hours.
3. Uses Gemini's free tier to group headlines, match existing stories and score risk and reader interest.
4. Adds new developments to existing stories, and drafts new ones from at least two outlets' article text.
5. Checks every draft (`scripts/pipeline/validate.ts`), then runs `verify`, the build and the tests. If any gate fails, nothing is committed.

Publishing policy (`AUTO_PUBLISH` variable): `low` (default) publishes low-risk drafts and parks medium-risk ones in `drafts/` for a human; `all` publishes both; `none` parks everything. Auto-drafted pages say so on the page.

Setup in GitHub > Settings > Secrets and variables > Actions:
- Secret `GEMINI_API_KEY`: a free key from https://aistudio.google.com/apikey (use a free-tier key, not a billed one).
- Optional secret `DEPLOY_HOOK_URL`: your host's deploy hook, so "NEW" badges refresh on quiet days.
- Optional variables `AUTO_PUBLISH`, `SITE_URL`.

Hosting (free): connect the repo to Cloudflare Pages (build `npm run build`, output `dist`, Node 24). Every daily commit redeploys the site.

Run it locally: `node scripts/pipeline/run.ts` (without a key it only does the freshness step).

## Content

- `src/content/records/<category>/<slug>.md`: one controversy per file, with `regions` (india, america, europe). All facts sit in frontmatter: `tldr`, `status`, `timeline[].claims[]`, `responses`, `sources[]`.
- `src/content/entities/*.md`: people, clubs and organisations. Hub pages are generated from the records that reference them; a hub with fewer than two records is `noindex` and stays out of the sitemap.
- `src/content/explainers/*.md`: "why / what is" pages with a short answer box.

Legal guards are enforced by the schema in `src/content.config.ts`, so the build fails when:
- a claim cites no source, or cites an unknown source id;
- a claim labelled `fact` has no official, court or on-record source (use `reported` instead);
- an allegation or response does not say who makes it;
- a page has an allegation but no response and no `noResponseFound` check;
- a timeline is out of date order, or a page is marked `riskTier: high`.

## Changes from the Phase 1 plan

1. **Worldwide English**: unambiguous dates ("13 Oct 2026"), "football (soccer)" in descriptions for US search, and cricket coverage aimed at India, Australia, New Zealand and the UK.
2. **A fourth claim label, `reported`**: the plan allowed only fact, allegation and response. Claims that rest only on news reporting are now labelled honestly instead of being dropped or overstated.
3. **Gen Z distribution built in**: TL;DR, a swipeable story mode, and a 1080×1920 story card per record for Instagram and WhatsApp status, plus native share.
4. **Answer-engine readiness**: `llms.txt`, a short-answer box on explainers, and entity `sameAs` links in JSON-LD.
5. **Own sitemap**: `lastmod` uses the real "facts changed" date, and thin hubs are excluded. There is also a 48-hour Google News sitemap.
6. **npm instead of pnpm**: the same Astro 7.3 + Tailwind 4.3 setup already builds cleanly with npm in the Protest project.
7. **Freshness instead of a heat score**: every story shows how long ago its latest verified development was (NEW within 3 days), and the site only carries the last 30 days.

## Before launch

- An editor signs off each page (`reviewedBy`), then `npm run verify:strict` must pass.
- Run `npm run archive` (and `-- --save` for sources with no snapshot).
- Name the grievance officer (`src/pages/grievance.astro`) and set the real emails in `src/site.ts`.
- Register lorecheck.co and add a deploy step to `.github/workflows/ci.yml`.
