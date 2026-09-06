import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { buildSearchUrl, MARKETPLACE_LIST } from "../lib/scraper";
import { Btn, IconArrowR, IconBolt, IconDb, IconGlobe, IconLayers, IconShield, IconTerminal, LogoMark, MTag, Reveal, StatusDot } from "../components/ui";

const TERMINAL_POOL = [
  { lvl: "net", text: "GET kijiji.ca/b-search-results?keywords=iphone+15+pro&page=2" },
  { lvl: "ok", text: "200 OK · 12 listings parsed (json-ld)" },
  { lvl: "tr", text: "translate EN→DE · 18 texts · 11 cache hits" },
  { lvl: "net", text: "GET olx.pl/q-iphone-15-pro/?page=1" },
  { lvl: "warn", text: "HTTP 429 · exponential backoff 1.4s" },
  { lvl: "ok", text: "200 OK · 14 raw listings · 2 duplicates skipped" },
  { lvl: "db", text: "INSERT listings · 11 rows · RLS user-scoped" },
  { lvl: "net", text: "GET ricardo.ch/en/s/?q=iphone+15+pro" },
  { lvl: "ok", text: "200 OK · 7 listings parsed (embedded json)" },
  { lvl: "tr", text: "translate FR→DE · cache hit 71%" },
  { lvl: "db", text: "COMMIT · run #a41f completed in 8.3s" },
];

const LVL_COLOR: Record<string, string> = {
  net: "text-kj-400",
  ok: "text-ok-400",
  tr: "text-amber-400",
  warn: "text-warn-400",
  db: "text-teal-400",
};

const TICKER_PAIRS = [
  { orig: "Sprzedam: iPhone 15, stan bardzo dobry", de: "Verkaufe: iPhone 15, sehr guter Zustand" },
  { orig: "Selling my MacBook Air — like new, original box", de: "Verkaufe mein MacBook Air — als neu, Originalverpackung" },
  { orig: "À vendre : casque Sony, très bon état", de: "Zu verkaufen: Sony Kopfhörer, sehr guter Zustand" },
  { orig: "Używany, sprawny — możliwa wysyłka", de: "Gebraucht, funktionsfähig — Versand möglich" },
  { orig: "Barely used, battery health 96%, warranty", de: "Kaum genutzt, Akkukapazität 96%, Garantie" },
];

const PIPELINE = [
  { n: "01", title: "Query", body: "One search term, three marketplaces, price & location filters.", icon: <IconGlobe size={17} /> },
  { n: "02", title: "Parallel capture", body: "Per-source scraper jobs with rate limits & exponential backoff.", icon: <IconBolt size={17} /> },
  { n: "03", title: "Translate → DE", body: "Every title and description into German, cached by text hash.", icon: <IconLayers size={17} /> },
  { n: "04", title: "Deduplicate", body: "Three-tier matching: listing id → canonical URL → fuzzy hash.", icon: <IconShield size={17} /> },
  { n: "05", title: "Store", body: "PostgreSQL with row-level security — you only ever see your data.", icon: <IconDb size={17} /> },
  { n: "06", title: "Filter & export", body: "Search, sort, slice — then CSV or JSON straight to your disk.", icon: <IconTerminal size={17} /> },
];

function stamp(offset: number): string {
  const d = new Date(Date.now() - offset);
  return d.toLocaleTimeString("en-GB", { hour12: false });
}

export default function Home() {
  const { user } = useAuth();
  const [lines, setLines] = useState<Array<{ id: number; lvl: string; text: string; ts: string }>>([]);
  const [pairIdx, setPairIdx] = useState(0);

  useEffect(() => {
    let i = 0;
    setLines(
      Array.from({ length: 6 }, (_, k) => {
        const p = TERMINAL_POOL[k % TERMINAL_POOL.length];
        return { id: k, ...p, ts: stamp((6 - k) * 900) };
      }),
    );
    const t = setInterval(() => {
      i++;
      const p = TERMINAL_POOL[i % TERMINAL_POOL.length];
      setLines((prev) => [...prev.slice(-8), { id: 1000 + i, ...p, ts: stamp(0) }]);
    }, 1150);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setPairIdx((p) => (p + 1) % TICKER_PAIRS.length), 3000);
    return () => clearInterval(t);
  }, []);

  const sampleParams = useMemo(() => ({ query: "iphone 15 pro", marketplaces: ["kijiji", "olx", "ricardo"] as const, pages: 5, limit: 100 }), []);
  const pair = TICKER_PAIRS[pairIdx];

  return (
    <div className="overflow-x-clip">
      {/* ============ opening: capture console ============ */}
      <section className="mx-auto grid max-w-7xl gap-10 px-5 pb-20 pt-14 lg:grid-cols-[1.15fr_0.85fr] lg:gap-14 lg:pt-20">
        <div className="anim-rise">
          <p className="mb-5 inline-flex items-center gap-2.5 rounded-full border border-ink-600/70 bg-ink-850/80 py-1.5 pl-2 pr-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-fog-400">
            <StatusDot color="#46D98C" pulse />
            3 sources · live adapters · DE translation
          </p>
          <h1 className="font-display text-[clamp(2.5rem,6vw,4.4rem)] font-extrabold leading-[1.02] tracking-tight text-fog-50">
            Search thousands of
            <br />
            <span className="relative inline-block text-amber-400">
              marketplace listings
              <svg className="absolute -bottom-2 left-0 w-full" height="10" viewBox="0 0 300 10" preserveAspectRatio="none" aria-hidden>
                <path d="M2 7C60 2 180 2 298 6" stroke="#35D3BE" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.75" />
              </svg>
            </span>
            <br />
            in one run.
          </h1>
          <p className="mt-6 max-w-xl text-[16px] leading-relaxed text-fog-300">
            Scrape <strong className="font-semibold text-kj-400">Kijiji</strong>, <strong className="font-semibold text-olx-400">OLX Poland</strong> and{" "}
            <strong className="font-semibold text-ric-400">Ricardo</strong> simultaneously — every title and description automatically translated to{" "}
            <strong className="font-semibold text-fog-100">German</strong>, deduplicated and stored to your private workspace.
          </p>

          {/* live translation strip */}
          <div className="mt-7 max-w-xl rounded-xl border border-ink-600/60 bg-ink-900/70 px-4 py-3">
            <div className="mb-1.5 flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[0.18em] text-fog-500">
              <IconLayers size={13} className="text-amber-400" /> translation engine · demo dictionary
            </div>
            <div key={pairIdx} className="anim-tick grid gap-1 sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-3">
              <span className="truncate font-mono text-[12.5px] text-fog-400">{pair.orig}</span>
              <IconArrowR size={14} className="hidden text-amber-400 sm:block" />
              <span className="truncate font-mono text-[12.5px] font-medium text-teal-300">{pair.de}</span>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3.5">
            <Link to={user ? "/dashboard" : "/login"}>
              <Btn size="lg" className="group">
                Open Dashboard
                <IconArrowR size={16} className="transition-transform duration-200 group-hover:translate-x-0.5" />
              </Btn>
            </Link>
            {!user && (
              <Link to="/login">
                <Btn size="lg" variant="outline">Create free account</Btn>
              </Link>
            )}
          </div>

          <div className="mt-9 flex flex-wrap gap-x-8 gap-y-3 font-mono text-[12px] text-fog-500">
            <span><span className="font-semibold text-fog-200">24,318</span> listings captured</span>
            <span><span className="font-semibold text-fog-200">1,204</span> searches</span>
            <span><span className="font-semibold text-fog-200">98.2%</span> translation cache hits</span>
          </div>
        </div>

        {/* terminal */}
        <div className="anim-rise" style={{ animationDelay: "120ms" }}>
          <div className="panel term-scanline relative overflow-hidden rounded-2xl">
            <div className="flex items-center gap-2 border-b hairline px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-err-500/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-warn-400/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-ok-500/80" />
              <span className="ml-3 font-mono text-[11.5px] font-medium text-fog-400">capture — live run #a41f</span>
              <span className="ml-auto flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-widest text-ok-400">
                <StatusDot color="#46D98C" pulse /> live
              </span>
            </div>
            <div className="h-[248px] overflow-hidden px-4 py-3 font-mono text-[11.5px] leading-[1.9]">
              {lines.map((l) => (
                <div key={l.id} className="log-line flex gap-2.5 whitespace-nowrap">
                  <span className="shrink-0 text-fog-600">{l.ts}</span>
                  <span className={`shrink-0 ${LVL_COLOR[l.lvl]}`}>[{l.lvl}]</span>
                  <span className="truncate text-fog-300">{l.text}</span>
                </div>
              ))}
              <div className="flex gap-2.5">
                <span className="text-fog-600">{stamp(0)}</span>
                <span className="anim-blink text-amber-400">▌</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 border-t hairline px-4 py-3.5">
              {MARKETPLACE_LIST.map((m, i) => (
                <div key={m.id}>
                  <div className="mb-1.5 flex items-center justify-between font-mono text-[10.5px] text-fog-400">
                    <span style={{ color: m.color }}>{m.short}</span>
                    <span>{34 - i * 7}</span>
                  </div>
                  <div className="h-[5px] overflow-hidden rounded-full bg-ink-700">
                    <div className="bar-home h-full rounded-full" style={{ background: m.color, animationDelay: `${i * 1.4}s` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <p className="mt-3 text-center font-mono text-[11px] text-fog-600">
            demo capture stream · deterministic fixture engine (SCRAPER_DEMO_MODE)
          </p>
        </div>
      </section>

      {/* ============ marquee ============ */}
      <section className="border-y hairline bg-ink-900/50 py-4">
        <div className="marquee-track flex w-max gap-10 whitespace-nowrap font-mono text-[12px] text-fog-500">
          {[0, 1].map((dup) => (
            <div key={dup} className="flex gap-10">
              {[
                "iPhone 15 Pro · Toronto · CA$1,299", "Sony A7 III · Warszawa · 5 499 zł", "Vitamx Blender · Zürich · CHF 389.–",
                "Lego Technic 42151 · Kraków · 749 zł", "MacBook Air M2 · Vancouver · CA$1,150", "Dyson V15 · Bern · CHF 519.–",
                "Switch OLED · Gdańsk · 899 zł", "Canon R6 · Montreal · CA$2,099",
              ].map((t) => (
                <span key={t} className="flex items-center gap-3">
                  <span className="text-amber-500/70">▸</span> {t}
                </span>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* ============ pipeline ============ */}
      <section className="mx-auto max-w-7xl px-5 py-20 lg:py-24">
        <Reveal>
          <div className="mb-12 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mb-2 font-mono text-[11.5px] font-semibold uppercase tracking-[0.2em] text-teal-400">the pipeline</p>
              <h2 className="font-display text-3xl font-extrabold tracking-tight text-fog-50 sm:text-4xl">
                From raw HTML to a clean German dataset
              </h2>
            </div>
            <p className="max-w-xs text-[13.5px] leading-relaxed text-fog-400">
              Six stages, fully automated. Long jobs never block your browser — status streams in live.
            </p>
          </div>
        </Reveal>
        <div className="relative">
          <div className="absolute left-0 right-0 top-[26px] hidden border-t border-dashed border-ink-600/70 lg:block" aria-hidden />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
            {PIPELINE.map((step, i) => (
              <Reveal key={step.n} delay={i * 90}>
                <div className={`panel panel-hover relative h-full rounded-xl p-4 ${i % 2 === 1 ? "lg:translate-y-6" : ""}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-display text-[26px] font-extrabold leading-none text-ink-600">{step.n}</span>
                    <span className="text-amber-400">{step.icon}</span>
                  </div>
                  <h3 className="mt-3 font-display text-[15px] font-bold text-fog-100">{step.title}</h3>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-fog-400">{step.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============ adapters ============ */}
      <section className="border-t hairline bg-ink-900/40">
        <div className="mx-auto max-w-7xl px-5 py-20">
          <Reveal>
            <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="mb-2 font-mono text-[11.5px] font-semibold uppercase tracking-[0.2em] text-amber-400">marketplace adapters</p>
                <h2 className="font-display text-3xl font-extrabold tracking-tight text-fog-50 sm:text-4xl">One interface, three markets</h2>
              </div>
              <p className="max-w-sm text-[13.5px] leading-relaxed text-fog-400">
                Each scraper builds real search URLs and extracts via JSON-LD → embedded JSON → HTML fallback. Live previews below for{" "}
                <span className="font-mono text-fog-200">“iphone 15 pro”</span>.
              </p>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <div className="panel overflow-hidden rounded-2xl">
              <div className="hidden grid-cols-[1.1fr_0.7fr_0.6fr_0.6fr_1.6fr_0.8fr] gap-4 border-b hairline bg-ink-850/70 px-5 py-3 font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-fog-500 md:grid">
                <span>Source</span><span>Country</span><span>Currency</span><span>Language</span><span>Search endpoint (live URL builder)</span><span>Status</span>
              </div>
              {MARKETPLACE_LIST.map((m) => (
                <div key={m.id} className="group grid gap-2 border-b hairline px-5 py-4 transition-colors last:border-b-0 hover:bg-ink-800/50 md:grid-cols-[1.1fr_0.7fr_0.6fr_0.6fr_1.6fr_0.8fr] md:items-center md:gap-4">
                  <div className="flex items-center gap-2.5">
                    <MTag id={m.id} />
                    <span className="text-[13px] font-medium text-fog-300">{m.domain}</span>
                  </div>
                  <span className="text-[13px] text-fog-300">{m.country}</span>
                  <span className="font-mono text-[12.5px] text-fog-200">{m.currency}</span>
                  <span className="font-mono text-[12.5px] uppercase text-fog-400">{m.defaultLang}</span>
                  <code className="block truncate rounded-md border border-ink-600/50 bg-ink-950/70 px-2.5 py-1.5 font-mono text-[11px] text-teal-300/90 transition-colors group-hover:border-teal-500/40">
                    {buildSearchUrl(m.id, { ...sampleParams, marketplaces: [m.id] }, 1)}
                  </code>
                  <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-ok-500/35 bg-ok-500/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider text-ok-400">
                    <StatusDot color="#46D98C" /> ready
                  </span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============ no-installs band ============ */}
      <section className="mx-auto max-w-7xl px-5 py-20 lg:py-24">
        <Reveal>
          <div className="panel relative overflow-hidden rounded-3xl px-6 py-12 sm:px-12 lg:px-16">
            <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" aria-hidden />
            <div className="pointer-events-none absolute -bottom-28 -left-20 h-72 w-72 rounded-full bg-teal-500/10 blur-3xl" aria-hidden />
            <div className="relative grid gap-10 lg:grid-cols-2 lg:items-center">
              <div>
                <div className="mb-5 flex items-center gap-3">
                  <LogoMark size={34} className="text-fog-200" />
                  <p className="font-mono text-[11.5px] font-semibold uppercase tracking-[0.2em] text-fog-400">zero local setup</p>
                </div>
                <h2 className="font-display text-[clamp(1.9rem,3.6vw,2.8rem)] font-extrabold leading-[1.06] tracking-tight text-fog-50">
                  No Python. No pip.
                  <br />
                  No <span className="text-err-400 line-through decoration-2 decoration-err-500/60">virtualenv</span>. Just a URL.
                </h2>
                <p className="mt-4 max-w-md text-[14.5px] leading-relaxed text-fog-300">
                  The entire platform runs in the cloud and is operated exclusively through your browser — sign in, search, scrape, export.
                </p>
                <Link to={user ? "/dashboard" : "/login"} className="mt-7 inline-block">
                  <Btn size="lg">
                    {user ? "Continue to dashboard" : "Open Dashboard"} <IconArrowR size={16} />
                  </Btn>
                </Link>
              </div>
              <ul className="grid gap-3.5">
                {[
                  { icon: <IconBolt size={17} />, title: "Serverless scraping jobs", body: "Background job model with rate limits, retries and per-source isolation — one failing market never stops the run." },
                  { icon: <IconShield size={17} />, title: "Private by default", body: "E-mail/password auth with row-level security: your searches, listings and translations are invisible to everyone else." },
                  { icon: <IconLayers size={17} />, title: "Cached translations", body: "Identical texts are translated once and reused by hash — repeat searches cost almost nothing." },
                ].map((f) => (
                  <li key={f.title} className="flex gap-4 rounded-xl border border-ink-600/50 bg-ink-900/60 p-4 transition-colors hover:border-amber-500/40">
                    <span className="mt-0.5 shrink-0 text-amber-400">{f.icon}</span>
                    <div>
                      <h3 className="text-[14px] font-bold text-fog-100">{f.title}</h3>
                      <p className="mt-1 text-[12.5px] leading-relaxed text-fog-400">{f.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
