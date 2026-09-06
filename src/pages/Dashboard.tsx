import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { EngineParams, MarketplaceId, RunProgress } from "../types";
import { useAuth } from "../lib/auth";
import { getSettings, getStats, listSearches, queryListings } from "../lib/db";
import { startScrape, subscribeRun, requestCancel, getRun } from "../lib/engine";
import { MARKETPLACES, MARKETPLACE_LIST } from "../lib/scraper";
import { fmtInt, timeAgo } from "../lib/util";
import {
  Bar, Btn, Check, EmptyState, Field, IconArrowR, IconPlay, IconRadar, IconSearch, IconStop,
  MTag, SmartImage, Spinner, Stat, StatusDot, TextInput, Select, useToast,
} from "../components/ui";

export default function Dashboard() {
  const { user } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const settings = useMemo(() => getSettings(user!.id), [user]);

  const [query, setQuery] = useState("");
  const [markets, setMarkets] = useState<MarketplaceId[]>(settings.default_marketplaces);
  const [location, setLocation] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [currency, setCurrency] = useState("any");
  const [pages, setPages] = useState(5);
  const [limit, setLimit] = useState(100);
  const [formError, setFormError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const [run, setRun] = useState<RunProgress | null>(getRun());
  const stats = useMemo(() => getStats(user!.id), [user, run?.status]);
  const recent = useMemo(() => listSearches(user!.id).slice(0, 4), [user, run?.status]);

  useEffect(() => subscribeRun(setRun), []);

  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [run?.log.length]);

  const toggleMarket = useCallback((id: MarketplaceId, on: boolean) => {
    setMarkets((m) => (on ? [...new Set([...m, id])] : m.filter((x) => x !== id)));
  }, []);

  const start = async () => {
    setFormError(null);
    if (!query.trim()) return setFormError("Enter a search term, e.g. “iPhone 15 Pro”.");
    if (markets.length === 0) return setFormError("Select at least one marketplace.");
    if (priceMin && priceMax && Number(priceMin) > Number(priceMax)) return setFormError("Minimum price is higher than maximum price.");

    const params: EngineParams = {
      query: query.trim(),
      marketplaces: markets,
      location: location.trim() || undefined,
      price_min: priceMin ? Number(priceMin) : undefined,
      price_max: priceMax ? Number(priceMax) : undefined,
      currency: currency === "any" ? undefined : currency,
      pages: Math.min(20, Math.max(1, pages)),
      limit: Math.min(500, Math.max(10, limit)),
    };
    setStarting(true);
    try {
      push("info", `Search started — capturing ${markets.length} source${markets.length > 1 ? "s" : ""} for “${params.query}”.`);
      const summary = await startScrape(user!, params, settings);
      if (summary.status === "completed") {
        push("ok", `Search completed — ${summary.inserted} new listings (${summary.duplicates} duplicates skipped).`);
      } else if (summary.status === "cancelled") {
        push("warn", "Scrape job cancelled.");
      } else {
        push("err", "All sources reported errors — nothing was saved.");
      }
      navigate("/listings");
    } catch (err) {
      push("err", err instanceof Error ? err.message : "Could not start the scrape job.");
    } finally {
      setStarting(false);
    }
  };

  const running = run?.status === "running";
  const totalFound = run ? run.marketplaces.reduce((a, m) => a + run.stats[m].found, 0) : 0;
  const overall = run
    ? run.marketplaces.reduce((a, m) => a + run.stats[m].progress, 0) / run.marketplaces.length
    : 0;

  return (
    <div className="mx-auto max-w-7xl px-5 py-10">
      {/* header + stats */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
        <div className="anim-rise">
          <p className="mb-1.5 font-mono text-[11.5px] font-semibold uppercase tracking-[0.2em] text-teal-400">control room</p>
          <h1 className="font-display text-[clamp(1.8rem,3.4vw,2.6rem)] font-extrabold tracking-tight text-fog-50">
            Dashboard
          </h1>
        </div>
        <div className="anim-rise flex flex-wrap gap-x-10 gap-y-4" style={{ animationDelay: "80ms" }}>
          <Stat label="Listings" value={fmtInt(stats.listings)} />
          <Stat label="Searches" value={fmtInt(stats.searches)} />
          <Stat label="Cache entries" value={fmtInt(stats.translations)} accent="#FFB224" />
          <Stat label="Sources" value={Object.values(stats.by_market).map((n) => fmtInt(n)).join(" · ")} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        {/* ============ search form ============ */}
        <section className="panel anim-rise h-fit rounded-2xl p-5 sm:p-6" style={{ animationDelay: "60ms" }}>
          <h2 className="mb-4 flex items-center gap-2.5 font-display text-[17px] font-bold text-fog-100">
            <IconSearch size={17} className="text-amber-400" /> New capture
          </h2>

          <div className="space-y-4">
            <Field label="Search">
              <TextInput
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !running && start()}
                placeholder="iPhone 15 Pro"
                className="text-[15px] font-medium"
                autoFocus
              />
            </Field>

            <Field label="Marketplaces">
              <div className="grid gap-2">
                {MARKETPLACE_LIST.map((m) => (
                  <Check
                    key={m.id}
                    checked={markets.includes(m.id)}
                    onChange={(v) => toggleMarket(m.id, v)}
                    dotColor={m.color}
                    label={
                      <span className="flex w-full items-center justify-between gap-2">
                        {m.name}
                        <span className="font-mono text-[10.5px] text-fog-500">{m.currency} · {m.country}</span>
                      </span>
                    }
                  />
                ))}
              </div>
            </Field>

            <Field label="Location" hint="optional">
              <TextInput value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Toronto, Warszawa, Zürich" />
            </Field>

            <div className="grid grid-cols-3 gap-2.5">
              <Field label="Min price">
                <TextInput type="number" min={0} value={priceMin} onChange={(e) => setPriceMin(e.target.value)} placeholder="0" />
              </Field>
              <Field label="Max price">
                <TextInput type="number" min={0} value={priceMax} onChange={(e) => setPriceMax(e.target.value)} placeholder="∞" />
              </Field>
              <Field label="Currency">
                <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  <option value="any">Any</option>
                  <option value="CAD">CAD</option>
                  <option value="PLN">PLN</option>
                  <option value="CHF">CHF</option>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                </Select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Pages" hint="1–20">
                <TextInput type="number" min={1} max={20} value={pages} onChange={(e) => setPages(Number(e.target.value) || 1)} />
              </Field>
              <Field label="Limit" hint="10–500">
                <TextInput type="number" min={10} max={500} step={10} value={limit} onChange={(e) => setLimit(Number(e.target.value) || 100)} />
              </Field>
            </div>

            {formError && (
              <p className="anim-fade rounded-lg border border-warn-400/40 bg-warn-400/10 px-3 py-2 text-[12.5px] font-medium text-warn-400">
                {formError}
              </p>
            )}

            <Btn size="lg" className="w-full" onClick={start} loading={starting} disabled={running}>
              {running ? (
                <>Job running… <Spinner size={14} /></>
              ) : (
                <><IconPlay size={15} /> Start Scraping</>
              )}
            </Btn>
            <p className="text-center font-mono text-[10.5px] leading-relaxed text-fog-600">
              polite delays {settings.request_delay_min}–{settings.request_delay_max}ms · concurrency {settings.concurrency} ·{" "}
              {settings.demo_mode ? "demo engine" : "live engine"}
            </p>
          </div>
        </section>

        {/* ============ live monitor ============ */}
        <section className="anim-rise flex flex-col gap-6" style={{ animationDelay: "140ms" }}>
          <div className="panel rounded-2xl p-5 sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2.5 font-display text-[17px] font-bold text-fog-100">
                <IconRadar size={18} className="text-teal-400" /> Live run monitor
              </h2>
              {run ? (
                <div className="flex items-center gap-3">
                  {running && (
                    <Btn variant="danger" size="sm" onClick={() => requestCancel()}>
                      <IconStop size={12} /> Cancel
                    </Btn>
                  )}
                  <span
                    className={`rounded-full border px-3 py-1 font-mono text-[10.5px] font-bold uppercase tracking-widest ${
                      run.status === "running"
                        ? "border-warn-400/40 bg-warn-400/10 text-warn-400"
                        : run.status === "completed"
                          ? "border-ok-500/40 bg-ok-500/10 text-ok-400"
                          : run.status === "cancelled"
                            ? "border-ink-500 bg-ink-700/50 text-fog-400"
                            : "border-err-500/40 bg-err-500/10 text-err-400"
                    }`}
                  >
                    {running ? "scraping…" : run.status}
                  </span>
                </div>
              ) : null}
            </div>

            {!run ? (
              <EmptyState
                icon={<IconRadar size={26} />}
                title="No active run"
                body="Enter a query on the left and press Start Scraping — per-source progress, translation counts and logs stream in here in real time."
              />
            ) : (
              <div>
                <div className="mb-5 flex flex-wrap items-center gap-x-8 gap-y-3">
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-[30px] font-bold tabular-nums text-fog-50">{Math.round(overall * 100)}%</span>
                    <span className="text-[12px] font-semibold uppercase tracking-widest text-fog-500">overall</span>
                  </div>
                  <div className="flex gap-6 font-mono text-[12px] text-fog-400">
                    <span><span className="font-semibold text-fog-100">{fmtInt(totalFound)}</span> found</span>
                    <span><span className="font-semibold text-ok-400">{fmtInt(run.inserted)}</span> saved</span>
                    <span><span className="font-semibold text-amber-400">{fmtInt(run.translated)}</span> translated</span>
                    <span><span className="font-semibold text-teal-400">{fmtInt(run.cache_hits)}</span> cache hits</span>
                    <span><span className="font-semibold text-fog-300">{fmtInt(run.duplicates)}</span> dupes</span>
                  </div>
                </div>

                <div className="space-y-4">
                  {run.marketplaces.map((id) => {
                    const st = run.stats[id];
                    const meta = MARKETPLACES[id];
                    return (
                      <div key={id} className="rounded-xl border border-ink-600/50 bg-ink-900/50 p-4">
                        <div className="mb-2 flex flex-wrap items-center gap-2.5">
                          <StatusDot color={st.status === "error" ? "#FF6B6B" : st.status === "running" ? meta.color : st.status === "done" ? "#46D98C" : "#526A84"} pulse={st.status === "running"} />
                          <span className="text-[13.5px] font-bold text-fog-100">{meta.name}</span>
                          <span className="font-mono text-[11px] text-fog-500">page {st.pages_done}/{run.pages}</span>
                          <span className="ml-auto font-mono text-[11.5px] tabular-nums" style={{ color: meta.color }}>
                            {Math.round(st.progress * 100)}%
                          </span>
                        </div>
                        <Bar value={st.progress} color={meta.color} active={st.status === "running"} />
                        <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[11px] text-fog-400">
                          <span>found <span className="text-fog-100">{st.found}</span></span>
                          <span>processed <span className="text-fog-100">{st.processed}</span></span>
                          <span>translated <span className="text-amber-400">{st.translated}</span></span>
                          <span>dupes <span className="text-teal-400">{st.duplicates}</span></span>
                          <span>errors <span className={st.errors ? "text-err-400" : "text-fog-100"}>{st.errors}</span></span>
                          {st.message && <span className="text-warn-400">· {st.message}</span>}
                          {st.status === "waiting" && <span className="text-fog-500">Waiting…</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* log console */}
                <div className="mt-5 overflow-hidden rounded-xl border border-ink-600/50 bg-ink-950/80">
                  <div className="flex items-center justify-between border-b hairline px-3.5 py-2">
                    <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-fog-500">job log</span>
                    <span className="font-mono text-[10.5px] text-fog-600">{run.log.length} events</span>
                  </div>
                  <div ref={logRef} className="h-40 overflow-y-auto px-3.5 py-2.5 font-mono text-[11px] leading-[1.85]">
                    {run.log.map((l, i) => (
                      <div key={i} className="log-line flex gap-2.5">
                        <span className="shrink-0 text-fog-600">{new Date(l.t).toLocaleTimeString("en-GB", { hour12: false })}</span>
                        {l.source && <span className="shrink-0 font-semibold text-fog-400">[{l.source}]</span>}
                        <span className={l.level === "err" ? "text-err-400" : l.level === "warn" ? "text-warn-400" : l.level === "ok" ? "text-ok-400" : "text-fog-300"}>
                          {l.text}
                        </span>
                      </div>
                    ))}
                    {running && <div className="anim-blink text-amber-400">▌</div>}
                  </div>
                </div>

                {!running && (
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link to={`/listings?search=${run.search_id}`}>
                      <Btn variant="outline"><IconArrowR size={14} /> View results ({fmtInt(run.inserted + run.duplicates)})</Btn>
                    </Link>
                    <Btn variant="ghost" onClick={() => setQuery(run.query)}>Reuse query</Btn>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* recent searches */}
          <div className="panel rounded-2xl p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-[16px] font-bold text-fog-100">Recent captures</h2>
              <Link to="/searches" className="link-underline text-[12.5px] font-semibold text-amber-400">Search history →</Link>
            </div>
            {recent.length === 0 ? (
              <p className="py-4 text-[13px] text-fog-500">No captures yet — your search history will appear here.</p>
            ) : (
              <div className="divide-y divide-ink-700/60">
                {recent.map((s) => (
                  <div key={s.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-fog-100">“{s.query}”</span>
                    <span className="flex gap-1.5">{s.marketplaces.map((m) => <MTag key={m} id={m} size="sm" />)}</span>
                    <span className="font-mono text-[11.5px] tabular-nums text-fog-400">{fmtInt(s.listing_count)} results</span>
                    <span className="font-mono text-[11px] text-fog-600">{timeAgo(s.created_at)}</span>
                    <Link to={`/listings?search=${s.id}`} className="text-fog-500 transition-colors hover:text-amber-400">
                      <IconArrowR size={14} />
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* latest listings strip */}
          <LatestStrip userId={user!.id} />
        </section>
      </div>
    </div>
  );
}

function LatestStrip({ userId }: { userId: string }) {
  const latest = useMemo(
    () => queryListings(userId, { sort: "newest", page: 1, per_page: 4 }).rows,
    [userId],
  );
  if (latest.length === 0) return null;
  return (
    <div className="panel rounded-2xl p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-[16px] font-bold text-fog-100">Freshest finds</h2>
        <Link to="/listings" className="link-underline text-[12.5px] font-semibold text-amber-400">All listings →</Link>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {latest.map((l) => (
          <Link key={l.id} to={`/listing/${l.id}`} className="group overflow-hidden rounded-xl border border-ink-600/50 bg-ink-900/50 transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-500/50">
            <SmartImage src={l.images[0]} alt={l.title_german} className="aspect-[4/3] w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" />
            <div className="p-2.5">
              <p className="truncate text-[12px] font-semibold text-fog-100">{l.title_german}</p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="font-mono text-[11.5px] font-bold text-amber-400">{l.price !== undefined ? fmtInt(l.price) : "—"} {l.currency}</span>
                <MTag id={l.marketplace} size="sm" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
