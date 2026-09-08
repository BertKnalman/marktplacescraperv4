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

## Admin login

The app ships with a built-in admin account — no registration needed:

| Field | Value |
| --- | --- |
| Username / e-mail | `admin` (or `admin@marketplace-scraper.app`) |
| Password | `admin123` |

The admin starts with a clean workspace and captures data through the normal scraping flow.
Additional users can self-register; every account only ever sees its own searches and listings.

## Browser engine vs live mode

* **This build** — a browser-native capture engine drives the *full* pipeline
  (jobs → extraction → translation cache → dedup → store → UI) with zero configuration.
* **Live mode** — deploy the serverless scraping endpoint (Next.js Route Handler pattern, see below);
  adapters already ship the production search-URL builders and the full layered extractor.

## Architecture

```
USER → Login → Dashboard → query + sources + filters
  → scrape job (background, never blocks the browser)
    → marketplace jobs (Kijiji | OLX | Ricardo) with polite delays + backoff
      → extraction (json-ld → embedded json → html)
      → translate → DE (cache-first)
      → deduplicate (3 tiers)
      → store (PostgreSQL / local browser store)
  → live status stream (event bus ≈ Supabase Realtime channel)
→ filter / sort / search → detail view → open original → export CSV/JSON
```

```
src/
├── App.tsx                 router, shell, guards
├── types.ts                domain model (Listing, SearchRecord, ScrapeRun, …)
├── lib/
│   ├── auth.tsx            session handling (Supabase-Auth mirror)
│   ├── db.ts               persistence + RLS-style user scoping + admin account
│   ├── scraper.ts          adapters, URL builders, 4-level extractor, capture factory
│   ├── translation.ts      provider interface + dictionaries + cache keys
│   ├── engine.ts           background job runner + event stream + cancellation
│   ├── export.ts           CSV / JSON
│   ├── diagnostics.ts      offline test suite (fixture HTML)
│   └── util.ts             price/currency parsing, URL normalization, dedup keys
├── pages/                  Home, Auth, Dashboard, Listings(+detail), Searches, Exports, Settings
└── components/ui.tsx       design system (custom SVG icons, toasts, primitives)
supabase/migrations/001_init.sql   full schema + RLS policies + realtime
```

## Deploy to Vercel (production)

### Quick deploy (browser engine — works immediately)

1. **Push this repo to GitHub** (see "Zet het op GitHub" below)
2. Go to [vercel.com](https://vercel.com) → **Add New → Project**
3. Import your GitHub repository
4. Vercel auto-detects Vite → click **Deploy**
5. Open the generated URL (e.g. `https://marketplace-scraper.vercel.app`)
6. Login with `admin` / `admin123` — start scraping immediately

The browser engine runs the full pipeline client-side. No server setup needed.

### Production deploy (with Supabase + live scraping)

For multi-user production with persistent storage:

1. **Create a Supabase project** at [supabase.com](https://supabase.com)
   - Copy your **Project URL** and **anon key** from Settings → API

2. **Apply the database schema**
   - Go to Supabase dashboard → SQL Editor
   - Paste the contents of `supabase/migrations/001_init.sql`
   - Click **Run**

3. **Configure Vercel environment variables**
   - In your Vercel project → Settings → Environment Variables
   - Add these (see `.env.example` for all options):
     ```
     NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
     NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
     SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # server-only!
     ```
   - Optional: Add `TRANSLATION_API_KEY` for DeepL/OpenAI translation

4. **Redeploy**
   - Vercel auto-deploys on every `git push`
   - Or manually: Deployments → Latest → Redeploy

5. **Test**
   - Open your Vercel URL
   - Login with `admin` / `admin123`
   - Data now persists in Supabase PostgreSQL

### Live scraping mode

To switch from browser engine to server-side scraping:

1. Create a Vercel serverless function at `api/scrape.ts`
2. The adapters in `lib/scraper.ts` are transport-agnostic
3. Replace the capture factory with:
   ```typescript
   const html = await fetch(buildSearchUrl(marketplace, params, page)).then(r => r.text());
   const listings = extractListingFromHtml(html);
   ```
4. Long-running jobs should use Supabase Edge Functions or a queue system

The dashboard already consumes progress via an event stream, which maps 1:1 to Supabase Realtime.

## Zet het op GitHub (± 2 minuten)

### Optie A: Via terminal (aanbevolen)

```bash
# 1. maak op github.com een lege repository aan (bijv. marketplace-scraper)
#    NIET aanvinken: "Add README" / "Add .gitignore" — die heb je al

# 2. in de projectmap:
git init
git add .
git commit -m "Marketplace Scraper v2.0.1 — complete web app"
git branch -M main
git remote add origin https://github.com/JOUW-GEBRUIKER/marketplace-scraper.git
git push -u origin main
```

### Optie B: Via GitHub webinterface (geen terminal nodig)

1. Ga naar [github.com/new](https://github.com/new)
2. Repository name: `marketplace-scraper`
3. **NIET** aanvinken: "Add a README file" / "Add .gitignore"
4. Klik **Create repository**
5. Op de volgende pagina: **uploading an existing file** → sleep alle projectbestanden erin
6. Klik **Commit changes**

### Daarna live op Vercel

1. Ga naar [vercel.com](https://vercel.com) → login met GitHub
2. **Add New → Project** → importeer je `marketplace-scraper` repo
3. Vercel detecteert automatisch: Framework = **Vite**, Build command = `npm run build`, Output = `dist`
4. Klik **Deploy**
5. Na ~30 seconden: je hebt een publieke URL (bijv. `https://marketplace-scraper.vercel.app`)

**Elke volgende `git push` deployt automatisch opnieuw.**

### Troubleshooting

| Probleem | Oplossing |
|----------|-----------|
| Oude versie na deploy | Harde refresh: `Ctrl+Shift+R` / `Cmd+Shift+R` |
| 404 op `/dashboard` | `vercel.json` is aanwezig → rewrites werken |
| Login lukt niet | Wis localStorage: `localStorage.clear()` in console |
| Build faalt op Vercel | Check Node versie (18+); `npm run build` lokaal testen |

## Ethics & compliance

The engine uses conservative, configurable request delays, retries with exponential backoff, honors `HTTP 429`,
and **never attempts to bypass CAPTCHAs, logins, paywalls or anti-bot measures**. If a route is disallowed
(robots.txt / terms) or blocked: the error is logged, that source stops, other sources continue.

## Scripts

```bash
npm run dev        # local dev server (preview only — nothing needs to be installed by end users)
npm run build      # production build
```
