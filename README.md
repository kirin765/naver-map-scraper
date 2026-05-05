# naver-map-scraper

Naver Map search-result scraper MVP built with TypeScript, Playwright, and Postgres.

## What it does

- Crawls `map.naver.com` search result lists for a `keyword + region` query
- Normalizes place data into a stable Postgres schema
- Stores crawl targets, runs, place snapshots, search observations, and review samples
- Keeps the scraper structured so detail-page enrichment can be added later

## Project structure

- `src/db/migrations`: SQL schema migrations
- `src/scrapers/naver-map/list`: list navigation, parsing, and normalization
- `src/pipelines/run-list-crawl.ts`: end-to-end crawl orchestration
- `src/cli/index.ts`: CLI entrypoint

## Setup

1. Install dependencies
   - `npm install`

2. Copy environment variables
   - `cp .env.example .env`

3. Update `DATABASE_URL` in `.env`

4. Run migrations
   - `npm run migrate`

## Usage

Run a crawl:

```bash
npm run crawl -- --keyword "카페" --region "성수동" --max-results 50 --review-sample-limit 5
```

Harvest category samples from Seoul search queries:

```bash
npm run categories -- --region "서울" --sample-count 24 --max-results 12
```

This command persists category harvests to Postgres via `category_harvest_runs` and `category_terms`.

Run a periodic category loop that stops after consecutive idle cycles:

```bash
npm run categories-loop -- --region "서울" --sample-count 24 --max-results 12 --interval-seconds 1800 --max-idle-runs 2
```

Run directly through the CLI entrypoint:

```bash
npm run dev -- crawl --keyword "카페" --region "성수동"
```

## Scripts

- `npm run build`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run migrate`
- `npm run crawl -- --keyword "<keyword>" --region "<region>"`
- `npm run categories -- --region "<region>"`

## Notes

- The current implementation targets search result lists only.
- Some fields may not always be visible in list results; the schema allows nullable values where necessary.
- Selector arrays live in `src/scrapers/naver-map/list/selectors.ts` so DOM updates stay localized.
