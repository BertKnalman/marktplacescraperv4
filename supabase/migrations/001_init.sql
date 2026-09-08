-- ============================================================
-- Marketplace Scraper — Supabase schema + Row Level Security
-- Apply in the Supabase SQL editor (or `supabase db push`).
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- profiles (1:1 with auth.users) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now()
);

-- ---------- searches ----------
create table if not exists public.searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  query text not null,
  marketplaces text[] not null default '{}',
  location text,
  price_min numeric,
  price_max numeric,
  currency text,
  pages int not null default 5,
  limit_count int not null default 100,
  listing_count int not null default 0,
  last_run_status text,
  created_at timestamptz not null default now()
);
create index if not exists searches_user_created_idx on public.searches (user_id, created_at desc);

-- ---------- scrape_runs ----------
create table if not exists public.scrape_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  search_id uuid not null references public.searches (id) on delete cascade,
  status text not null default 'running',
  inserted int not null default 0,
  duplicates int not null default 0,
  translated int not null default 0,
  cache_hits int not null default 0,
  stats jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_ms int
);
create index if not exists runs_user_idx on public.scrape_runs (user_id, created_at desc);
create index if not exists runs_search_idx on public.scrape_runs (search_id);

-- ---------- listings ----------
create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  marketplace text not null,
  marketplace_listing_id text,
  url text not null,
  title_original text not null default '',
  title_german text not null default '',
  description_original text not null default '',
  description_german text not null default '',
  price numeric,
  currency text,
  price_original text,
  location text,
  published_at timestamptz,
  condition text,
  source_lang text,
  search_id uuid references public.searches (id) on delete set null,
  run_id uuid references public.scrape_runs (id) on delete set null,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  scraped_at timestamptz not null default now()
);
create index if not exists listings_user_market_idx on public.listings (user_id, marketplace);
create index if not exists listings_market_id_idx on public.listings (marketplace, marketplace_listing_id);
create index if not exists listings_url_idx on public.listings (url);
create index if not exists listings_created_idx on public.listings (created_at desc)
  -- created_at alias for scraped_at lookups
  ;
create index if not exists listings_price_idx on public.listings (user_id, price);
create index if not exists listings_search_idx on public.listings (search_id);

-- unique per (user, marketplace, listing id) — the first dedup tier in SQL
create unique index if not exists listings_dedupe_idx
  on public.listings (user_id, marketplace, coalesce(marketplace_listing_id, url));

-- ---------- listing_images ----------
create table if not exists public.listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  position int not null default 0,
  url text not null,
  storage_path text -- optional Supabase Storage mirror
);
create index if not exists images_listing_idx on public.listing_images (listing_id, position);

-- ---------- translations (cache) ----------
create table if not exists public.translations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source_text_hash text not null,
  source_text text not null,
  source_lang text not null,
  target_language text not null default 'de',
  translated_text text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists translations_hash_idx
  on public.translations (user_id, source_text_hash, target_language);

-- ---------- exports log ----------
create table if not exists public.exports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  format text not null,
  count int not null default 0,
  filename text not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Row Level Security: users only ever see their own rows.
-- ============================================================
alter table public.profiles enable row level security;
alter table public.searches enable row level security;
alter table public.scrape_runs enable row level security;
alter table public.listings enable row level security;
alter table public.listing_images enable row level security;
alter table public.translations enable row level security;
alter table public.exports enable row level security;

-- profiles
create policy "profiles select own" on public.profiles for select using (auth.uid() = id);
create policy "profiles insert own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles update own" on public.profiles for update using (auth.uid() = id);

-- searches
create policy "searches select own" on public.searches for select using (auth.uid() = user_id);
create policy "searches insert own" on public.searches for insert with check (auth.uid() = user_id);
create policy "searches update own" on public.searches for update using (auth.uid() = user_id);
create policy "searches delete own" on public.searches for delete using (auth.uid() = user_id);

-- scrape_runs
create policy "runs select own" on public.scrape_runs for select using (auth.uid() = user_id);
create policy "runs insert own" on public.scrape_runs for insert with check (auth.uid() = user_id);
create policy "runs update own" on public.scrape_runs for update using (auth.uid() = user_id);
create policy "runs delete own" on public.scrape_runs for delete using (auth.uid() = user_id);

-- listings
create policy "listings select own" on public.listings for select using (auth.uid() = user_id);
create policy "listings insert own" on public.listings for insert with check (auth.uid() = user_id);
create policy "listings update own" on public.listings for update using (auth.uid() = user_id);
create policy "listings delete own" on public.listings for delete using (auth.uid() = user_id);

-- listing_images
create policy "images select own" on public.listing_images for select using (auth.uid() = user_id);
create policy "images insert own" on public.listing_images for insert with check (auth.uid() = user_id);
create policy "images delete own" on public.listing_images for delete using (auth.uid() = user_id);

-- translations
create policy "translations select own" on public.translations for select using (auth.uid() = user_id);
create policy "translations insert own" on public.translations for insert with check (auth.uid() = user_id);

-- exports
create policy "exports select own" on public.exports for select using (auth.uid() = user_id);
create policy "exports insert own" on public.exports for insert with check (auth.uid() = user_id);

-- ============================================================
-- Realtime: stream scrape-run progress to the dashboard
-- ============================================================
alter publication supabase_realtime add table public.scrape_runs;
