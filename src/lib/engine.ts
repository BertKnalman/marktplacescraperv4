/**
 * Cloud-compatible scrape job runner.
 *
 * The frontend never blocks on one long HTTP request: startScrape() returns
 * immediately, jobs run in the background and push RunProgress snapshots over an
 * event bus (the same contract a Supabase Realtime channel or an SSE stream would
 * expose in a server deployment). A failing marketplace is isolated — the others
 * keep running.
 */

import type {
  EngineParams, Listing, MarketplaceId, RunProgress, RunStats, ScrapeSummary, SettingsRow, UserRow,
} from "../types";
import {
  createRun, createSearch, persistNow, putTranslations, getTranslations, updateRun, updateSearchMeta, upsertListings, queryListings,
} from "./db";
import { getScraper, MARKETPLACES } from "./scraper";
import { getProvider } from "./translation";
import { clamp, hashStr, mulberry32, rint, sleep, uuid } from "./util";

type Listener = (run: RunProgress | null) => void;

let current: RunProgress | null = null;
let listeners = new Set<Listener>();
let cancelRequested = false;

export function getRun(): RunProgress | null {
  return current;
}

/** Immutable snapshot so React state updates are always detected. */
function snapshot(): RunProgress | null {
  if (!current) return null;
  return {
    ...current,
    marketplaces: [...current.marketplaces],
    stats: {
      kijiji: { ...current.stats.kijiji },
      olx: { ...current.stats.olx },
      ricardo: { ...current.stats.ricardo },
    },
    log: [...current.log],
  };
}

export function subscribeRun(fn: Listener): () => void {
  listeners.add(fn);
  fn(snapshot());
  return () => {
    listeners.delete(fn);
  };
}

function emit(): void {
  const snap = snapshot();
  for (const fn of listeners) fn(snap);
}

export function isRunning(): boolean {
  return current?.status === "running";
}

export function requestCancel(): void {
  if (isRunning()) cancelRequested = true;
}

function emptyStats(): Record<MarketplaceId, RunStats> {
  const s = (): RunStats => ({
    status: "waiting", pages_done: 0, found: 0, processed: 0, translated: 0,
    errors: 0, duplicates: 0, progress: 0,
  });
  return { kijiji: s(), olx: s(), ricardo: s() };
}

export function startScrape(user: UserRow, params: EngineParams, settings: SettingsRow): Promise<ScrapeSummary> {
  if (isRunning()) return Promise.reject(new Error("A scrape job is already running."));
  cancelRequested = false;
  bindUser(user.id);

  const search = createSearch(user.id, params);
  const run = createRun(user.id, search.id);
  const startedAt = Date.now();

  current = {
    run_id: run.id,
    search_id: search.id,
    query: params.query,
    marketplaces: [...params.marketplaces],
    pages: params.pages,
    status: "running",
    started_at: startedAt,
    stats: emptyStats(),
    log: [],
    inserted: 0,
    duplicates: 0,
    translated: 0,
    cache_hits: 0,
    limit: params.limit,
  };

  const log = (level: "info" | "ok" | "warn" | "err", text: string, source?: string) => {
    current!.log = [...current!.log.slice(-120), { t: Date.now(), level, source, text }];
    emit();
  };

  const runJob = async (): Promise<void> => {
    const provider = getProvider(settings.translation_provider);
    const knownKeys = new Set<string>();
    const markets = [...params.marketplaces];
    log("info", `job ${run.id.slice(0, 8)} started · query “${params.query}” · ${markets.length} source${markets.length > 1 ? "s" : ""} · limit ${params.limit}`);

    const marketJobs = markets.map((id) => runMarketplace(id, params, settings, knownKeys, log, provider.id));

    // respect configured concurrency (1 = sequential, 3 = all in parallel)
    const conc = clamp(settings.concurrency, 1, 3);
    const queue = [...marketJobs];
    const workers = Array.from({ length: Math.min(conc, queue.length) }, async () => {
      while (queue.length) {
        const job = queue.shift();
        if (job) await job;
      }
    });
    await Promise.all(workers);

    // ---- finalize ----
    const finishedAt = Date.now();
    const anyError = markets.some((m) => current!.stats[m].status === "error");
    const cancelled = cancelRequested;
    current!.status = cancelled ? "cancelled" : anyError && markets.every((m) => current!.stats[m].status === "error") ? "failed" : "completed";
    current!.finished_at = finishedAt;
    for (const m of markets) {
      const st = current!.stats[m];
      if (st.status === "running") st.status = "done";
      if (st.status === "done") st.progress = 1;
    }

    const listingTotal = queryListings(user.id, { search_id: search.id, sort: "newest", page: 1, per_page: 1 }).total;

    updateRun(user.id, run.id, {
      status: current!.status,
      finished_at: new Date(finishedAt).toISOString(),
      duration_ms: finishedAt - startedAt,
      inserted: current!.inserted,
      duplicates: current!.duplicates,
      translated: current!.translated,
      cache_hits: current!.cache_hits,
      stats: { ...current!.stats },
    });
    updateSearchMeta(user.id, search.id, {
      listing_count: listingTotal,
      last_run_status: current!.status,
    });
    persistNow();

    const summaryStatus = current!.status;
    if (summaryStatus === "completed") log("ok", `job completed in ${((finishedAt - startedAt) / 1000).toFixed(1)}s — ${current!.inserted} new listings saved`);
    if (summaryStatus === "cancelled") log("warn", "job cancelled by user");
    if (summaryStatus === "failed") log("err", "job failed — all sources reported errors");
    emit();
  };

  const summary = new Promise<ScrapeSummary>((resolve) => {
    runJob().then(() => {
      resolve({
        run_id: run.id,
        search_id: search.id,
        inserted: current!.inserted,
        duplicates: current!.duplicates,
        translated: current!.translated,
        cache_hits: current!.cache_hits,
        errors: current!.marketplaces.reduce((acc, m) => acc + current!.stats[m].errors, 0),
        status: current!.status,
        duration_ms: (current!.finished_at ?? Date.now()) - startedAt,
        by_market: { ...current!.stats },
      });
    });
  });

  emit();
  return summary;
}

function runMarketplace(
  id: MarketplaceId,
  params: EngineParams,
  settings: SettingsRow,
  knownKeys: Set<string>,
  log: (level: "info" | "ok" | "warn" | "err", text: string, source?: string) => void,
  providerId: string,
): () => Promise<void> {
  const meta = MARKETPLACES[id];
  const scraper = getScraper(id);

  return async () => {
    const st = current!.stats[id];
    st.status = "running";
    st.message = undefined;
    log("info", `${meta.name}: opening search (${params.pages} page${params.pages > 1 ? "s" : ""}, ${meta.currency})`, meta.short);
    emit();

    const expected = Math.max(1, Math.min(meta.avgPerPage * params.pages, params.limit));
    let consecutiveErrors = 0;

    for (let page = 1; page <= params.pages; page++) {
      if (cancelRequested) {
        st.status = "cancelled";
        st.message = "cancelled";
        log("warn", `${meta.name}: cancelled by user`, meta.short);
        return;
      }
      const totalProcessed = current!.inserted + current!.duplicates;
      if (totalProcessed >= params.limit) {
        log("info", `${meta.name}: global limit of ${params.limit} reached — stopping early`, meta.short);
        break;
      }

      // polite pacing between requests
      const delay = rint(mulberry32(Date.now() % 100000 + page), Math.max(120, settings.request_delay_min), Math.max(300, settings.request_delay_max));
      await sleep(Math.min(delay, 1600));

      try {
        // The adapter owns transport + extraction; a cloud deployment points it
        // at fetch(buildSearchUrl(...)) → extractListingFromHtml(html).
        const batchRaw = await scraper.searchListings(params, page, {
          onEvent: (e) => {
            if (e.type === "retry") log("warn", e.text, meta.short);
            else log("info", e.text, meta.short);
          },
        });

        st.found += batchRaw.length;
        consecutiveErrors = 0;

        // ---- translate (cache-first) ----
        const texts: Array<{ text: string; lang: string }> = [];
        for (const g of batchRaw) {
          texts.push({ text: g.title, lang: g.source_lang }, { text: g.description, lang: g.source_lang });
        }
        const hashes = texts.map((t) => hashStr(`${t.lang}:${t.text}`));
        const cached = getTranslations(hashes);
        const now = new Date().toISOString();
        const map = new Map<string, string>();
        let misses = 0;
        const toStore: Array<Parameters<typeof putTranslations>[0][number]> = [];
        texts.forEach((t, i) => {
          const hit = cached.get(hashes[i]);
          if (hit) {
            map.set(hashes[i], hit.translated_text);
          } else {
            misses++;
            const translated = getProvider(providerId).translate(t.text, t.lang);
            map.set(hashes[i], translated);
            toStore.push({
              id: uuid(),
              user_id: current!.search_id ? getUserIdHack() : getUserIdHack(),
              source_text_hash: hashes[i],
              source_text: t.text,
              source_lang: t.lang,
              target_language: "de",
              translated_text: translated,
              created_at: now,
            });
          }
        });
        if (toStore.length) putTranslations(toStore);
        current!.cache_hits += texts.length - misses;
        current!.translated += texts.length;
        st.translated += texts.length;

        // ---- persist + dedupe ----
        const rows: Listing[] = batchRaw.map((g) => ({
          id: uuid(),
          user_id: getUserIdHack(),
          marketplace: g.marketplace,
          marketplace_listing_id: g.marketplace_listing_id,
          url: g.url,
          title_original: g.title,
          title_german: map.get(hashStr(`${g.source_lang}:${g.title}`)) ?? g.title,
          description_original: g.description,
          description_german: map.get(hashStr(`${g.source_lang}:${g.description}`)) ?? g.description,
          price: g.price,
          currency: g.currency,
          price_original: g.price_original,
          images: g.images,
          location: g.location,
          published_at: g.published_at,
          condition: g.condition,
          source_lang: g.source_lang,
          search_id: current!.search_id,
          run_id: current!.run_id,
          first_seen: now,
          last_seen: now,
          scraped_at: now,
        }));
        const { inserted, duplicates } = upsertListings(getUserIdHack(), rows, knownKeys);
        current!.inserted += inserted;
        current!.duplicates += duplicates;
        st.processed += inserted + duplicates;
        st.duplicates += duplicates;
        st.pages_done = page;
        st.progress = clamp(st.processed / expected, 0.03, 1);

        const cacheHits = texts.length - misses;
        log("info", `${meta.name}: page ${page}/${params.pages} → ${batchRaw.length} raw · ${inserted} new · ${duplicates} duplicates skipped · ${cacheHits}/${texts.length} translation cache hits`, meta.short);
        emit();
      } catch (err) {
        st.errors++;
        consecutiveErrors++;
        log("err", `${meta.name}: ${err instanceof Error ? err.message : "request failed"} (attempt on page ${page})`, meta.short);
        if (consecutiveErrors >= 2) {
          st.status = "error";
          st.message = "temporarily unavailable — source skipped";
          log("warn", `${meta.name} temporarily unavailable. Continuing with remaining sources.`, meta.short);
          emit();
          return;
        }
      }
    }

    if (st.status === "running") {
      st.status = "done";
      st.progress = 1;
      if (st.found === 0) st.message = "no results for this query";
      log(st.found === 0 ? "warn" : "ok", `${meta.name}: finished — ${st.processed} listings (${st.duplicates} duplicates skipped)`, meta.short);
    }
    emit();
  };
}

/** The engine is started with an authenticated user; this binding keeps the closure simple. */
let boundUserId: string | null = null;
export function bindUser(userId: string): void {
  boundUserId = userId;
}
function getUserIdHack(): string {
  if (!boundUserId) throw new Error("Engine not bound to an authenticated user.");
  return boundUserId;
}
