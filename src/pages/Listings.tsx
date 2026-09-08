import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import type { Listing, MarketplaceId } from "../types";
import { useAuth } from "../lib/auth";
import { getSettings, listLocations, queryListings, getListing, getSearch } from "../lib/db";
import { MARKETPLACES, MARKETPLACE_LIST } from "../lib/scraper";
import { exportListings } from "../lib/export";
import { fmtInt, fmtDate, fmtDateTime, timeAgo } from "../lib/util";
import {
  Btn, EmptyState, IconChevronD, IconChevronL, IconChevronR, IconDownload, IconExternal,
  IconFilter, IconGrid, IconSearch, IconX, MTag, Select, SmartImage, TextInput, useToast,
} from "../components/ui";

type Sort = "newest" | "oldest" | "price_asc" | "price_desc";

export default function ListingsPage() {
  const { id } = useParams();
  if (id) return <ListingDetail id={id} />;
  return <ListingGrid />;
}

/* ================= grid ================= */

function ListingGrid() {
  const { user } = useAuth();
  const { push } = useToast();
  const [sp, setSp] = useSearchParams();
  const settings = useMemo(() => getSettings(user!.id), [user]);
  const searchId = sp.get("search") ?? undefined;
  const scopedSearch = useMemo(() => (searchId ? getSearch(user!.id, searchId) : undefined), [user, searchId]);

  const [q, setQ] = useState("");
  const [markets, setMarkets] = useState<MarketplaceId[]>([]);
  const [currency, setCurrency] = useState("all");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [location, setLocation] = useState("all");
  const [sort, setSort] = useState<Sort>("newest");
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const locations = useMemo(() => listLocations(user!.id), [user]);
  const perPage = settings.results_per_page;

  const result = useMemo(
    () =>
      queryListings(user!.id, {
        q,
        marketplaces: markets.length ? markets : null,
        currency,
        price_min: min ? Number(min) : undefined,
        price_max: max ? Number(max) : undefined,
        location,
        search_id: searchId,
        sort,
        page,
        per_page: perPage,
      }),
    [user, q, markets, currency, min, max, location, sort, page, perPage, searchId],
  );

  const totalPages = Math.max(1, Math.ceil(result.total / perPage));
  useEffect(() => setPage(1), [q, markets, currency, min, max, location, sort, searchId]);

  const filteredAll = useMemo(
    () =>
      queryListings(user!.id, {
        q,
        marketplaces: markets.length ? markets : null,
        currency,
        price_min: min ? Number(min) : undefined,
        price_max: max ? Number(max) : undefined,
        location,
        search_id: searchId,
        sort,
        page: 1,
        per_page: 100000,
      }).rows,
    [user, q, markets, currency, min, max, location, sort, searchId],
  );

  const doExport = (format: "csv" | "json") => {
    if (filteredAll.length === 0) {
      push("warn", "Nothing to export with the current filters.");
      return;
    }
    const { filename, count } = exportListings(user!.id, filteredAll, format, scopedSearch?.query ?? (q || "all"));
    push("ok", `Export ready — ${count} listings → ${filename}`);
  };

  const hasActiveFilters = q !== "" || markets.length > 0 || currency !== "all" || min !== "" || max !== "" || location !== "all" || !!searchId;

  return (
    <div className="mx-auto max-w-7xl px-5 py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="anim-rise">
          <p className="mb-1.5 font-mono text-[11.5px] font-semibold uppercase tracking-[0.2em] text-teal-400">captured inventory</p>
          <h1 className="font-display text-[clamp(1.8rem,3.4vw,2.6rem)] font-extrabold tracking-tight text-fog-50">
            Listings
            {scopedSearch && <span className="ml-3 text-[18px] font-semibold text-fog-400">· “{scopedSearch.query}”</span>}
          </h1>
        </div>
        <div className="anim-rise flex gap-2.5" style={{ animationDelay: "80ms" }}>
          <Btn variant="outline" size="sm" onClick={() => doExport("csv")}><IconDownload size={14} /> Export CSV</Btn>
          <Btn variant="outline" size="sm" onClick={() => doExport("json")}><IconDownload size={14} /> Export JSON</Btn>
        </div>
      </div>

      {/* toolbar */}
      <div className="panel anim-rise mb-6 rounded-2xl p-4" style={{ animationDelay: "60ms" }}>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[220px] flex-1">
            <IconSearch size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fog-500" />
            <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search results…" className="pl-10" />
          </div>
          {MARKETPLACE_LIST.map((m) => {
            const on = markets.includes(m.id);
            return (
              <button
                key={m.id}
                onClick={() => setMarkets((prev) => (on ? prev.filter((x) => x !== m.id) : [...prev, m.id]))}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-all duration-200 ${on ? "" : "border-ink-600/60 text-fog-400 hover:border-ink-500 hover:text-fog-200"}`}
                style={on ? { color: m.color, borderColor: `${m.color}55`, background: `${m.color}14` } : undefined}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: on ? m.color : "#526A84" }} />
                {m.short}
              </button>
            );
          })}
          <button
            onClick={() => setShowFilters((s) => !s)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-all ${showFilters ? "border-amber-500/55 text-amber-400" : "border-ink-600/60 text-fog-400 hover:text-fog-200"}`}
          >
            <IconFilter size={13} /> Filters
            <IconChevronD size={12} className={`transition-transform duration-200 ${showFilters ? "rotate-180" : ""}`} />
          </button>
          {hasActiveFilters && (
            <button
              onClick={() => { setQ(""); setMarkets([]); setCurrency("all"); setMin(""); setMax(""); setLocation("all"); if (searchId) setSp({}); }}
              className="flex items-center gap-1 text-[12px] font-semibold text-fog-500 transition-colors hover:text-err-400"
            >
              <IconX size={12} /> Clear
            </button>
          )}
          <span className="ml-auto font-mono text-[12px] tabular-nums text-fog-400">
            <span className="font-semibold text-fog-100">{fmtInt(result.total)}</span> results
          </span>
        </div>

        {showFilters && (
          <div className="anim-fade mt-4 grid grid-cols-2 gap-3 border-t hairline pt-4 md:grid-cols-5">
            <label className="block">
              <span className="mb-1 block text-[10.5px] font-bold uppercase tracking-[0.14em] text-fog-500">Currency</span>
              <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                <option value="all">All</option>
                {["CAD", "PLN", "CHF", "EUR", "USD"].map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[10.5px] font-bold uppercase tracking-[0.14em] text-fog-500">Min price</span>
              <TextInput type="number" value={min} onChange={(e) => setMin(e.target.value)} placeholder="0" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10.5px] font-bold uppercase tracking-[0.14em] text-fog-500">Max price</span>
              <TextInput type="number" value={max} onChange={(e) => setMax(e.target.value)} placeholder="∞" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10.5px] font-bold uppercase tracking-[0.14em] text-fog-500">Location</span>
              <Select value={location} onChange={(e) => setLocation(e.target.value)}>
                <option value="all">All locations</option>
                {locations.map((l) => <option key={l} value={l}>{l}</option>)}
              </Select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[10.5px] font-bold uppercase tracking-[0.14em] text-fog-500">Sort</span>
              <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="price_asc">Price low → high</option>
                <option value="price_desc">Price high → low</option>
              </Select>
            </label>
          </div>
        )}
      </div>

      {/* grid */}
      {result.total === 0 ? (
        <EmptyState
          icon={<IconGrid size={26} />}
          title={hasActiveFilters ? "No listings match these filters" : "Nothing captured yet"}
          body={hasActiveFilters ? "Loosen the filters or clear them to see your full inventory." : "Run a search from the dashboard — captured listings appear here with German titles, prices and images."}
          action={!hasActiveFilters ? <Link to="/dashboard"><Btn>Start your first scrape</Btn></Link> : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {result.rows.map((l, i) => (
            <ListingCard key={l.id} listing={l} index={i} />
          ))}
        </div>
      )}

      {/* pagination */}
      {result.total > 0 && (
        <div className="mt-8 flex items-center justify-center gap-3">
          <Btn variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            <IconChevronL size={13} /> Prev
          </Btn>
          <span className="font-mono text-[12.5px] tabular-nums text-fog-400">
            page <span className="font-semibold text-fog-100">{page}</span> / {totalPages}
          </span>
          <Btn variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next <IconChevronR size={13} />
          </Btn>
        </div>
      )}
    </div>
  );
}

function ListingCard({ listing: l, index }: { listing: Listing; index: number }) {
  return (
    <div className="panel panel-hover group anim-rise relative overflow-hidden rounded-2xl" style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}>
      <Link to={`/listing/${l.id}`} className="block">
        <div className="relative overflow-hidden">
          <SmartImage src={l.images[0]} alt={l.title_german} className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]" />
          <div className="absolute left-2.5 top-2.5 flex gap-1.5">
            <MTag id={l.marketplace} size="sm" />
          </div>
          {l.condition && (
            <span className="absolute bottom-2.5 left-2.5 rounded-md bg-ink-950/80 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-fog-300 backdrop-blur-sm">
              {l.condition}
            </span>
          )}
        </div>
        <div className="p-4">
          <h3 className="line-clamp-2 min-h-[40px] text-[13.5px] font-bold leading-snug text-fog-100 transition-colors group-hover:text-amber-300">
            {l.title_german}
          </h3>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="font-mono text-[17px] font-bold tabular-nums text-amber-400">
              {l.price !== undefined ? fmtInt(l.price) : "—"} <span className="text-[12px] text-fog-400">{l.currency}</span>
            </span>
            {l.price_original && l.price_original !== "" && (
              <span className="font-mono text-[11px] text-fog-600">{l.price_original}</span>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 text-[11.5px] text-fog-500">
            <span className="truncate">{l.location ?? "—"}</span>
            <span className="shrink-0 font-mono">{timeAgo(l.published_at ?? l.scraped_at)}</span>
          </div>
        </div>
      </Link>
      <div className="flex border-t hairline">
        <Link to={`/listing/${l.id}`} className="flex-1 py-2.5 text-center text-[12px] font-bold text-fog-300 transition-colors hover:bg-ink-700/50 hover:text-fog-50">
          Open advertisement
        </Link>
        <a
          href={l.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-14 items-center justify-center border-l hairline text-fog-500 transition-colors hover:bg-amber-500/10 hover:text-amber-400"
          title="Open original listing"
        >
          <IconExternal size={14} />
        </a>
      </div>
    </div>
  );
}

/* ================= detail ================= */

function ListingDetail({ id }: { id: string }) {
  const { user } = useAuth();
  const l = useMemo(() => getListing(user!.id, id), [user, id]);
  const [idx, setIdx] = useState(0);
  const [showOriginal, setShowOriginal] = useState(false);

  useEffect(() => setIdx(0), [id]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") window.history.back();
      if (e.key === "ArrowRight" && l) setIdx((i) => (i + 1) % Math.max(1, l.images.length));
      if (e.key === "ArrowLeft" && l) setIdx((i) => (i - 1 + Math.max(1, l.images.length)) % Math.max(1, l.images.length));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [l]);

  if (!l) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-20">
        <EmptyState
          icon={<IconGrid size={26} />}
          title="Listing not found"
          body="It may have been deleted with its search, or it belongs to another workspace."
          action={<Link to="/listings"><Btn variant="outline"><IconChevronL size={13} /> Back to listings</Btn></Link>}
        />
      </div>
    );
  }

  const meta = MARKETPLACES[l.marketplace];
  const img = l.images[Math.min(idx, l.images.length - 1)];

  return (
    <div className="mx-auto max-w-7xl px-5 py-10">
      <Link to="/listings" className="link-underline mb-6 inline-flex items-center gap-1.5 text-[13px] font-semibold text-fog-400 hover:text-amber-400">
        <IconChevronL size={14} /> Back to listings
      </Link>

      <div className="grid gap-8 lg:grid-cols-[1.05fr_1fr]">
        {/* gallery */}
        <div className="anim-rise">
          <div className="panel relative overflow-hidden rounded-2xl">
            <SmartImage key={img} src={img} alt={l.title_german} className="anim-fade aspect-[4/3] w-full object-cover" />
            {l.images.length > 1 && (
              <>
                <button
                  onClick={() => setIdx((i) => (i - 1 + l.images.length) % l.images.length)}
                  className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-ink-950/75 text-fog-200 backdrop-blur transition-all hover:bg-amber-500 hover:text-ink-950"
                  aria-label="Previous image"
                >
                  <IconChevronL size={16} />
                </button>
                <button
                  onClick={() => setIdx((i) => (i + 1) % l.images.length)}
                  className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-ink-950/75 text-fog-200 backdrop-blur transition-all hover:bg-amber-500 hover:text-ink-950"
                  aria-label="Next image"
                >
                  <IconChevronR size={16} />
                </button>
                <span className="absolute bottom-3 right-3 rounded-md bg-ink-950/80 px-2.5 py-1 font-mono text-[11px] text-fog-300 backdrop-blur">
                  {Math.min(idx, l.images.length - 1) + 1} / {l.images.length}
                </span>
              </>
            )}
          </div>
          {l.images.length > 1 && (
            <div className="mt-3 flex gap-2.5 overflow-x-auto pb-1">
              {l.images.map((src, i) => (
                <button
                  key={src + i}
                  onClick={() => setIdx(i)}
                  className={`shrink-0 overflow-hidden rounded-lg border-2 transition-all duration-200 ${i === idx ? "border-amber-500" : "border-transparent opacity-60 hover:opacity-100"}`}
                >
                  <SmartImage src={src} alt={`Image ${i + 1}`} className="h-16 w-20 object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* info */}
        <div className="anim-rise" style={{ animationDelay: "90ms" }}>
          <div className="flex flex-wrap items-center gap-2">
            <MTag id={l.marketplace} />
            {l.condition && <span className="rounded-full border border-ink-600/60 bg-ink-850 px-2.5 py-1 text-[11px] font-semibold text-fog-300">{l.condition}</span>}
            <span className="rounded-full border border-ink-600/60 bg-ink-850 px-2.5 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-wider text-fog-400">
              source: {l.source_lang} → de
            </span>
          </div>

          <h1 className="mt-4 font-display text-[clamp(1.5rem,3vw,2.1rem)] font-extrabold leading-[1.12] tracking-tight text-fog-50">
            {l.title_german}
          </h1>
          <p className="mt-2 text-[13px] italic leading-relaxed text-fog-500">
            Original ({l.source_lang.toUpperCase()}): {l.title_original}
          </p>

          <div className="mt-5 flex items-baseline gap-3">
            <span className="font-mono text-[34px] font-bold tabular-nums text-amber-400">
              {l.price !== undefined ? fmtInt(l.price) : "—"}
              <span className="ml-1.5 text-[16px] text-fog-400">{l.currency}</span>
            </span>
            {l.price_original && <span className="font-mono text-[13px] text-fog-500">{l.price_original}</span>}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-ink-600/50 bg-ink-600/40 sm:grid-cols-3">
            {[
              ["Marketplace", meta.name],
              ["Location", l.location ?? "—"],
              ["Published", l.published_at ? fmtDate(l.published_at) : "—"],
              ["First seen", fmtDateTime(l.first_seen)],
              ["Listing ID", l.marketplace_listing_id ? l.marketplace_listing_id.slice(0, 14) + "…" : "—"],
              ["Captured", timeAgo(l.scraped_at)],
            ].map(([k, v]) => (
              <div key={k} className="bg-ink-900/90 px-3.5 py-2.5">
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-fog-500">{k}</div>
                <div className="mt-0.5 truncate font-mono text-[12px] text-fog-200">{v}</div>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <h2 className="mb-2 flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-[0.16em] text-teal-400">
              Beschreibung · German
            </h2>
            <p className="rounded-xl border border-ink-600/50 bg-ink-900/60 p-4 text-[14px] leading-relaxed text-fog-200">
              {l.description_german}
            </p>
          </div>

          <div className="mt-3 overflow-hidden rounded-xl border border-ink-600/50">
            <button
              onClick={() => setShowOriginal((s) => !s)}
              className="flex w-full items-center justify-between bg-ink-900/60 px-4 py-3 text-[12.5px] font-semibold text-fog-300 transition-colors hover:bg-ink-800/70"
            >
              Original description ({l.source_lang.toUpperCase()})
              <IconChevronD size={14} className={`transition-transform duration-200 ${showOriginal ? "rotate-180" : ""}`} />
            </button>
            {showOriginal && (
              <p className="anim-fade border-t hairline bg-ink-950/50 p-4 text-[13.5px] leading-relaxed text-fog-400">
                {l.description_original}
              </p>
            )}
          </div>

          <div className="mt-7 flex flex-wrap gap-3">
            <a href={l.url} target="_blank" rel="noopener noreferrer">
              <Btn size="lg"><IconExternal size={15} /> Open original listing</Btn>
            </a>
            <Link to={`/listings?search=${l.search_id}`}>
              <Btn size="lg" variant="outline">More from this search</Btn>
            </Link>
          </div>

          <p className="mt-4 break-all font-mono text-[11px] leading-relaxed text-fog-600">{l.url}</p>
        </div>
      </div>
    </div>
  );
}
