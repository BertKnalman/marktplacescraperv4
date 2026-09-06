# Marketplace Scraper

A fully **web-based** scraping platform for [Kijiji](https://www.kijiji.ca), [OLX Poland](https://www.olx.pl) and
[Ricardo Switzerland](https://www.ricardo.ch). Search once, capture from three marketplaces in parallel, get every
title & description translated to **German**, deduplicated and stored — then filter, sort and export CSV/JSON.

> **No Python. No pip. No virtualenv. No local installs.** The end user only opens a URL and signs in.

---

## What's inside

| Area | Implementation |
| --- | --- |
| Auth | E-mail/password, token sessions, per-user isolation (RLS-ready) |
| Scrapers | `KijijiScraper`, `OlxScraper`, `RicardoScraper` behind one `MarketplaceScraper` interface |
| Extraction | 4-level pipeline: JSON-LD → embedded JSON → HTML/OG meta → (Playwright hook for JS-rendered pages) |
| Search URLs | Real URL builders incl. query / location / min-max price / page (see `lib/scraper.ts`) |
| Pagination | Stops on max pages, empty pages or global limit — no infinite loops |
| Dedup | 3 tiers: `marketplace+listingId` → canonical URL → hash(title+price+location) |
| Translation | Pluggable provider (offline dictionary built in; DeepL/OpenAI server-side), cached by text hash |
| Jobs | Background job runner with event stream, concurrency, rate limiting, exponential backoff, per-source error isolation |
| Export | CSV (RFC-4180 + BOM) and JSON, downloaded in the browser |
| Tests | Offline suite against fixture HTML (price/currency parsing, URL normalization, dedup, extraction, translation cache) — run it in **Settings → Diagnostics** |

## Demo mode vs live mode

* `SCRAPER_DEMO_MODE=true` (default in this build) — a deterministic fixture engine drives the *real* pipeline
  (jobs → translation cache → dedup → store → UI). Everything works end-to-end in the browser with zero secrets.
* `SCRAPER_DEMO_MODE=false` — deploy the serverless scraping endpoint (Next.js Route Handler pattern, see below);
  adapters already ship the production search-URL builders and the full layered extractor.

## Architecture

```
USER → Login → Dashboard → query + sources + filters
  → scrape job (background, never blocks the browser)
    → marketplace jobs (Kijiji | OLX | Ricardo) with polite delays + backoff
      → extraction (json-ld → embedded json → html)
      → translate → DE (cache-first)
      → deduplicate (3 tiers)
      → store (PostgreSQL / local demo store)
  → live status stream (event bus ≈ Supabase Realtime channel)
→ filter / sort / search → detail view → open original → export CSV/JSON
```

```
src/
├── App.tsx                 router, shell, guards
├── types.ts                domain model (Listing, SearchRecord, ScrapeRun, …)
├── lib/
│   ├── auth.tsx            session handling (Supabase-Auth mirror)
│   ├── db.ts               persistence + RLS-style user scoping + demo seeding
│   ├── scraper.ts          adapters, URL builders, 4-level extractor, demo factory
│   ├── translation.ts      provider interface + dictionaries + cache keys
│   ├── engine.ts           background job runner + event stream + cancellation
│   ├── export.ts           CSV / JSON
│   ├── diagnostics.ts      offline test suite (fixture HTML)
│   └── util.ts             price/currency parsing, URL normalization, dedup keys
├── pages/                  Home, Auth, Dashboard, Listings(+detail), Searches, Exports, Settings
└── components/ui.tsx       design system (custom SVG icons, toasts, primitives)
supabase/migrations/001_init.sql   full schema + RLS policies + realtime
```

## Deploy to production (Vercel + Supabase) — no local software needed

1. **Create a Supabase project** → copy URL + anon key.
2. **Apply the SQL migration**: Supabase dashboard → SQL editor → paste `supabase/migrations/001_init.sql` → run.
3. **Configure environment variables** on your hosting platform (see `.env.example`).
   Keep `SUPABASE_SERVICE_ROLE_KEY` and `TRANSLATION_API_KEY` **server-only** (no `NEXT_PUBLIC_` prefix).
4. **Connect the Git repository** to Vercel (or Cloudflare Pages) — build command `npm run build`.
5. **Deploy.** Open the printed URL, create an account, start scraping.

For live capture, host the scraper adapters as a serverless function (Next.js Route Handler `/api/scrape`); the
adapters in `lib/scraper.ts` are transport-agnostic — swap the demo factory call for
`fetch(buildSearchUrl(...))` → `extractListingFromHtml(html)`. Long jobs should run as queued background jobs
(e.g. Supabase Edge Function + pg-based queue) — the dashboard already consumes progress via an event stream,
which maps 1:1 to a Supabase Realtime channel on `scrape_runs`.

## Ethics & compliance

The engine uses conservative, configurable request delays, retries with exponential backoff, honors `HTTP 429`,
and **never attempts to bypass CAPTCHAs, logins, paywalls or anti-bot measures**. If a route is disallowed
(robots.txt / terms) or blocked: the error is logged, that source stops, other sources continue.

## Scripts

```bash
npm run dev        # local dev server (preview only — nothing needs to be installed by end users)
npm run build      # production build
```
