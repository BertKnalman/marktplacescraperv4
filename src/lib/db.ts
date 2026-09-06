/**
 * Persistence layer.
 *
 * Mirrors the Supabase schema 1:1 (profiles, searches, scrape_runs, listings,
 * listing_images, translations, exports). In this browser build every table lives in
 * a versioned localStorage document and ALL queries are scoped to the signed-in
 * user — the same isolation Supabase Row Level Security enforces server-side
 * (policies ship in supabase/migrations/001_init.sql).
 */

import type {
  ExportRow, Listing, MarketplaceId, ScrapeRun, SearchRecord, SettingsRow,
  TranslationRow, UserRow, WorkspaceStats, EngineParams,
} from "../types";
import { dedupeKey, seedFrom, mulberry32, rint, uuid } from "./util";
import { generateListings, MARKETPLACES } from "./scraper";
import { translateText } from "./translation";

interface ListingImageRow {
  id: string;
  listing_id: string;
  user_id: string;
  position: number;
  url: string;
}

interface Store {
  v: number;
  users: UserRow[];
  sessions: Record<string, string>; // token -> user_id
  searches: SearchRecord[];
  runs: ScrapeRun[];
  listings: Listing[];
  listing_images: ListingImageRow[];
  translations: TranslationRow[];
  exports: ExportRow[];
  settings: Record<string, SettingsRow>;
}

const KEY = "mscraper.db.v1";
let store: Store | null = null;

function empty(): Store {
  return {
    v: 1,
    users: [],
    sessions: {},
    searches: [],
    runs: [],
    listings: [],
    listing_images: [],
    translations: [],
    exports: [],
    settings: {},
  };
}

function load(): Store {
  if (store) return store;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      store = { ...empty(), ...(JSON.parse(raw) as Store) };
      return store;
    }
  } catch {
    /* corrupted document — start fresh */
  }
  store = empty();
  return store;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function persist() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(load()));
    } catch {
      /* quota exceeded — keep working in-memory */
    }
  }, 120);
}

export function persistNow(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(load()));
  } catch {
    /* noop */
  }
}

/* ================= users & sessions ================= */

export function createUser(email: string, passwordHash: string, displayName: string): UserRow {
  const s = load();
  const normalized = email.trim().toLowerCase();
  if (s.users.some((u) => u.email === normalized)) throw new Error("An account with this e-mail already exists.");
  const user: UserRow = {
    id: uuid(),
    email: normalized,
    password_hash: passwordHash,
    display_name: displayName || normalized.split("@")[0],
    created_at: new Date().toISOString(),
  };
  s.users.push(user);
  s.settings[user.id] = defaultSettings(user.id);
  persistNow();
  return user;
}

export function findUserByEmail(email: string): UserRow | undefined {
  return load().users.find((u) => u.email === email.trim().toLowerCase());
}

export function createSession(userId: string): string {
  const s = load();
  const token = uuid() + uuid();
  s.sessions[token] = userId;
  persistNow();
  return token;
}

export function getUserByToken(token: string | null): UserRow | null {
  if (!token) return null;
  const s = load();
  const userId = s.sessions[token];
  return s.users.find((u) => u.id === userId) ?? null;
}

export function destroySession(token: string): void {
  const s = load();
  delete s.sessions[token];
  persistNow();
}

/* ================= settings ================= */

export function defaultSettings(userId: string): SettingsRow {
  return {
    user_id: userId,
    default_language: "de",
    default_marketplaces: ["kijiji", "olx", "ricardo"],
    results_per_page: 24,
    request_delay_min: 400,
    request_delay_max: 1400,
    concurrency: 3,
    translation_provider: "local",
    translation_model: "dictionary-v1",
    demo_mode: true,
  };
}

export function getSettings(userId: string): SettingsRow {
  const s = load();
  return { ...defaultSettings(userId), ...s.settings[userId] };
}

export function saveSettings(userId: string, patch: Partial<SettingsRow>): SettingsRow {
  const s = load();
  const next = { ...getSettings(userId), ...patch, user_id: userId };
  s.settings[userId] = next;
  persist();
  return next;
}

/* ================= searches ================= */

export function createSearch(userId: string, params: EngineParams): SearchRecord {
  const s = load();
  const rec: SearchRecord = {
    id: uuid(),
    user_id: userId,
    query: params.query.trim(),
    marketplaces: [...params.marketplaces],
    location: params.location || undefined,
    price_min: params.price_min,
    price_max: params.price_max,
    currency: params.currency || undefined,
    pages: params.pages,
    limit: params.limit,
    created_at: new Date().toISOString(),
    listing_count: 0,
    last_run_status: "running",
  };
  s.searches.unshift(rec);
  persist();
  return rec;
}

export function listSearches(userId: string): SearchRecord[] {
  return load()
    .searches.filter((r) => r.user_id === userId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function getSearch(userId: string, id: string): SearchRecord | undefined {
  return load().searches.find((r) => r.user_id === userId && r.id === id);
}

export function deleteSearch(userId: string, id: string): void {
  const s = load();
  const runIds = s.runs.filter((r) => r.user_id === userId && r.search_id === id).map((r) => r.id);
  s.searches = s.searches.filter((r) => !(r.user_id === userId && r.id === id));
  s.runs = s.runs.filter((r) => !(r.user_id === userId && r.search_id === id));
  const listingIds = new Set(
    s.listings.filter((l) => l.user_id === userId && (runIds.includes(l.run_id) || l.search_id === id)).map((l) => l.id),
  );
  s.listings = s.listings.filter((l) => !listingIds.has(l.id));
  s.listing_images = s.listing_images.filter((i) => !listingIds.has(i.listing_id));
  persistNow();
}

export function updateSearchMeta(userId: string, searchId: string, patch: Partial<SearchRecord>): void {
  const s = load();
  const rec = s.searches.find((r) => r.user_id === userId && r.id === searchId);
  if (rec) {
    Object.assign(rec, patch);
    persist();
  }
}

/* ================= scrape runs ================= */

export function createRun(userId: string, searchId: string): ScrapeRun {
  const s = load();
  const run: ScrapeRun = {
    id: uuid(),
    user_id: userId,
    search_id: searchId,
    status: "running",
    created_at: new Date().toISOString(),
    inserted: 0,
    duplicates: 0,
    translated: 0,
    cache_hits: 0,
    stats: {},
  };
  s.runs.unshift(run);
  persist();
  return run;
}

export function updateRun(userId: string, runId: string, patch: Partial<ScrapeRun>): void {
  const s = load();
  const run = s.runs.find((r) => r.user_id === userId && r.id === runId);
  if (run) {
    Object.assign(run, patch);
    persist();
  }
}

export function listRuns(userId: string): ScrapeRun[] {
  return load()
    .runs.filter((r) => r.user_id === userId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/* ================= listings (with 3-tier dedup) ================= */

export function upsertListings(userId: string, rows: Listing[], knownKeys: Set<string>): { inserted: number; duplicates: number } {
  const s = load();
  let inserted = 0;
  let duplicates = 0;
  const now = new Date().toISOString();

  for (const row of rows) {
    const key = dedupeKey({
      marketplace: row.marketplace,
      marketplace_listing_id: row.marketplace_listing_id,
      url: row.url,
      title: row.title_original,
      price: row.price,
      location: row.location,
    });

    const existing =
      s.listings.find(
        (l) =>
          l.user_id === userId &&
          l.marketplace === row.marketplace &&
          l.marketplace_listing_id === row.marketplace_listing_id,
      ) ??
      s.listings.find((l) => l.user_id === userId && dedupeKey({
        marketplace: l.marketplace,
        marketplace_listing_id: l.marketplace_listing_id,
        url: l.url,
        title: l.title_original,
        price: l.price,
        location: l.location,
      }) === key);

    if (existing) {
      existing.last_seen = now;
      existing.scraped_at = now;
      duplicates++;
      continue;
    }
    if (knownKeys.has(key)) {
      duplicates++;
      continue;
    }
    knownKeys.add(key);
    row.first_seen = row.first_seen || now;
    row.last_seen = now;
    s.listings.unshift(row);
    row.images.forEach((url, pos) => {
      s.listing_images.push({ id: uuid(), listing_id: row.id, user_id: userId, position: pos, url });
    });
    inserted++;
  }
  persist();
  return { inserted, duplicates };
}

export interface ListingQuery {
  q?: string;
  marketplaces?: MarketplaceId[] | null;
  currency?: string;
  price_min?: number;
  price_max?: number;
  location?: string;
  search_id?: string;
  sort: "newest" | "oldest" | "price_asc" | "price_desc";
  page: number;
  per_page: number;
}

export function queryListings(userId: string, q: ListingQuery): { rows: Listing[]; total: number } {
  const s = load();
  let rows = s.listings.filter((l) => l.user_id === userId);

  if (q.search_id) rows = rows.filter((l) => l.search_id === q.search_id);
  if (q.marketplaces && q.marketplaces.length) rows = rows.filter((l) => q.marketplaces!.includes(l.marketplace));
  if (q.currency && q.currency !== "all") rows = rows.filter((l) => l.currency === q.currency);
  if (q.price_min !== undefined && !Number.isNaN(q.price_min)) rows = rows.filter((l) => (l.price ?? 0) >= q.price_min!);
  if (q.price_max !== undefined && !Number.isNaN(q.price_max)) rows = rows.filter((l) => (l.price ?? Infinity) <= q.price_max!);
  if (q.location && q.location !== "all") rows = rows.filter((l) => l.location === q.location);
  if (q.q && q.q.trim()) {
    const needle = q.q.trim().toLowerCase();
    rows = rows.filter(
      (l) =>
        l.title_german.toLowerCase().includes(needle) ||
        l.title_original.toLowerCase().includes(needle) ||
        l.description_german.toLowerCase().includes(needle) ||
        (l.location ?? "").toLowerCase().includes(needle),
    );
  }

  switch (q.sort) {
    case "newest":
      rows.sort((a, b) => (b.published_at ?? b.scraped_at).localeCompare(a.published_at ?? a.scraped_at));
      break;
    case "oldest":
      rows.sort((a, b) => (a.published_at ?? a.scraped_at).localeCompare(b.published_at ?? b.scraped_at));
      break;
    case "price_asc":
      rows.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
      break;
    case "price_desc":
      rows.sort((a, b) => (b.price ?? -1) - (a.price ?? -1));
      break;
  }

  const total = rows.length;
  const start = (Math.max(1, q.page) - 1) * q.per_page;
  return { rows: rows.slice(start, start + q.per_page), total };
}

export function getListing(userId: string, id: string): Listing | undefined {
  return load().listings.find((l) => l.user_id === userId && l.id === id);
}

export function listLocations(userId: string): string[] {
  const set = new Set<string>();
  for (const l of load().listings) if (l.user_id === userId && l.location) set.add(l.location);
  return Array.from(set).sort();
}

/* ================= translation cache ================= */

export function getTranslations(hashes: string[]): Map<string, TranslationRow> {
  const s = load();
  const wanted = new Set(hashes);
  const out = new Map<string, TranslationRow>();
  for (const t of s.translations) {
    if (wanted.has(t.source_text_hash)) out.set(t.source_text_hash, t);
  }
  return out;
}

export function putTranslations(rows: TranslationRow[]): void {
  const s = load();
  s.translations.push(...rows);
  persist();
}

/* ================= exports ================= */

export function logExport(userId: string, format: "csv" | "json", count: number, filename: string): ExportRow {
  const s = load();
  const row: ExportRow = { id: uuid(), user_id: userId, format, count, filename, created_at: new Date().toISOString() };
  s.exports.unshift(row);
  persist();
  return row;
}

export function listExports(userId: string): ExportRow[] {
  return load()
    .exports.filter((e) => e.user_id === userId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/* ================= stats & maintenance ================= */

export function getStats(userId: string): WorkspaceStats {
  const s = load();
  const mine = s.listings.filter((l) => l.user_id === userId);
  const by_market: Record<MarketplaceId, number> = { kijiji: 0, olx: 0, ricardo: 0 };
  for (const l of mine) by_market[l.marketplace]++;
  return {
    listings: mine.length,
    searches: s.searches.filter((x) => x.user_id === userId).length,
    runs: s.runs.filter((x) => x.user_id === userId).length,
    translations: s.translations.filter((x) => x.user_id === userId).length,
    by_market,
  };
}

export function clearUserData(userId: string): void {
  const s = load();
  s.searches = s.searches.filter((x) => x.user_id !== userId);
  s.runs = s.runs.filter((x) => x.user_id !== userId);
  s.listings = s.listings.filter((x) => x.user_id !== userId);
  s.listing_images = s.listing_images.filter((x) => x.user_id !== userId);
  s.translations = s.translations.filter((x) => x.user_id !== userId);
  s.exports = s.exports.filter((x) => x.user_id !== userId);
  persistNow();
}

/* ================= demo seeding ================= */

export const DEMO_EMAIL = "demo@marketplace-scraper.app";
export const DEMO_PASSWORD = "demo-2026";

function seedListingsFor(userId: string, searchId: string, runId: string, params: EngineParams, createdIso: string): number {
  const rng = mulberry32(seedFrom("seedmeta", searchId));
  const rows: Listing[] = [];
  const keys = new Set<string>();
  for (const market of params.marketplaces) {
    const meta = MARKETPLACES[market];
    for (let page = 1; page <= Math.min(params.pages, 2); page++) {
      const batch = generateListings(meta, params, page, rint(rng, 8, 12));
      for (const g of batch) {
        const tDe = translateText(g.title, g.source_lang);
        const dDe = translateText(g.description, g.source_lang);
        rows.push({
          id: uuid(),
          user_id: userId,
          marketplace: g.marketplace,
          marketplace_listing_id: g.marketplace_listing_id,
          url: g.url,
          title_original: g.title,
          title_german: tDe,
          description_original: g.description,
          description_german: dDe,
          price: g.price,
          currency: g.currency,
          price_original: g.price_original,
          images: g.images,
          location: g.location,
          published_at: g.published_at,
          condition: g.condition,
          source_lang: g.source_lang,
          search_id: searchId,
          run_id: runId,
          first_seen: createdIso,
          last_seen: createdIso,
          scraped_at: createdIso,
        });
      }
    }
  }
  const { inserted } = upsertListings(userId, rows, keys);
  return inserted;
}

/** Creates (or returns) the demo account with realistic seeded history. */
export function ensureDemoAccount(passwordHash: string): UserRow {
  const existing = findUserByEmail(DEMO_EMAIL);
  if (existing) return existing;
  const user = createUser(DEMO_EMAIL, passwordHash, "Demo Explorer");

  const seeds: Array<{ params: EngineParams; daysAgo: number }> = [
    { params: { query: "iPhone 15 Pro", marketplaces: ["kijiji", "olx", "ricardo"], pages: 3, limit: 100 }, daysAgo: 2 },
    { params: { query: "Sony A7 III", marketplaces: ["kijiji", "ricardo"], pages: 2, limit: 60 }, daysAgo: 6 },
    { params: { query: "Lego Technic", marketplaces: ["olx", "ricardo"], pages: 2, limit: 60 }, daysAgo: 0.3 },
  ];

  for (const seed of seeds) {
    const created = new Date(Date.now() - seed.daysAgo * 86400_000).toISOString();
    const search = createSearch(user.id, seed.params);
    search.created_at = created;
    const run = createRun(user.id, search.id);
    run.created_at = created;
    run.status = "completed";
    run.finished_at = created;
    run.duration_ms = 9000 + Math.round(seed.daysAgo * 1337);
    const inserted = seedListingsFor(user.id, search.id, run.id, seed.params, created);
    run.inserted = inserted;
    run.translated = inserted * 2;
    run.cache_hits = Math.round(inserted * 0.31);
    updateSearchMeta(user.id, search.id, { listing_count: inserted, last_run_status: "completed" });
  }
  persistNow();
  return user;
}
