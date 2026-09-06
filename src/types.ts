/** Shared domain types for the Marketplace Scraper platform. */

export type MarketplaceId = "kijiji" | "olx" | "ricardo";

export interface Listing {
  id: string;
  user_id: string;
  marketplace: MarketplaceId;
  marketplace_listing_id?: string;
  url: string;

  title_original: string;
  title_german: string;

  description_original: string;
  description_german: string;

  price?: number;
  currency: string;
  price_original?: string;

  images: string[];
  location?: string;
  published_at?: string;
  condition?: string;
  source_lang: string;

  search_id: string;
  run_id: string;

  first_seen: string;
  last_seen: string;
  scraped_at: string;
}

export interface SearchRecord {
  id: string;
  user_id: string;
  query: string;
  marketplaces: MarketplaceId[];
  location?: string;
  price_min?: number;
  price_max?: number;
  currency?: string;
  pages: number;
  limit: number;
  created_at: string;
  listing_count: number;
  last_run_status?: string;
}

export type SourceStatus = "waiting" | "running" | "done" | "error" | "cancelled";

export interface RunStats {
  status: SourceStatus;
  pages_done: number;
  found: number;
  processed: number;
  translated: number;
  errors: number;
  duplicates: number;
  progress: number; // 0..1
  message?: string;
}

export interface ScrapeRun {
  id: string;
  user_id: string;
  search_id: string;
  status: "running" | "completed" | "failed" | "cancelled";
  created_at: string;
  finished_at?: string;
  duration_ms?: number;
  inserted: number;
  duplicates: number;
  translated: number;
  cache_hits: number;
  stats: Partial<Record<MarketplaceId, RunStats>>;
}

export interface EngineLogLine {
  t: number;
  level: "info" | "ok" | "warn" | "err";
  source?: string;
  text: string;
}

export interface RunProgress {
  run_id: string;
  search_id: string;
  query: string;
  marketplaces: MarketplaceId[];
  pages: number;
  status: "running" | "completed" | "failed" | "cancelled";
  started_at: number;
  finished_at?: number;
  stats: Record<MarketplaceId, RunStats>;
  log: EngineLogLine[];
  inserted: number;
  duplicates: number;
  translated: number;
  cache_hits: number;
  limit: number;
}

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  created_at: string;
}

export interface SettingsRow {
  user_id: string;
  default_language: "de";
  default_marketplaces: MarketplaceId[];
  results_per_page: number;
  request_delay_min: number;
  request_delay_max: number;
  concurrency: number;
  translation_provider: "local" | "deepl" | "openai";
  translation_model: string;
}

export interface TranslationRow {
  id: string;
  user_id: string;
  source_text_hash: string;
  source_text: string;
  source_lang: string;
  target_language: string;
  translated_text: string;
  created_at: string;
}

export interface ExportRow {
  id: string;
  user_id: string;
  format: "csv" | "json";
  count: number;
  filename: string;
  created_at: string;
}

export interface EngineParams {
  query: string;
  marketplaces: MarketplaceId[];
  location?: string;
  price_min?: number;
  price_max?: number;
  currency?: string;
  pages: number;
  limit: number;
}

export interface ScrapeSummary {
  run_id: string;
  search_id: string;
  inserted: number;
  duplicates: number;
  translated: number;
  cache_hits: number;
  errors: number;
  status: ScrapeRun["status"];
  duration_ms: number;
  by_market: Partial<Record<MarketplaceId, RunStats>>;
}

export interface WorkspaceStats {
  listings: number;
  searches: number;
  runs: number;
  translations: number;
  by_market: Record<MarketplaceId, number>;
}
