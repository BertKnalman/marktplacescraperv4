import { useMemo, useState } from "react";
import { useAuth } from "../lib/auth";
import { clearUserData, getSettings, getStats, saveSettings } from "../lib/db";
import { runDiagnostics } from "../lib/diagnostics";
import type { DiagResult } from "../lib/diagnostics";
import { PROVIDERS } from "../lib/translation";
import { MARKETPLACE_LIST } from "../lib/scraper";
import type { MarketplaceId, SettingsRow } from "../types";
import { fmtInt } from "../lib/util";
import { Btn, Check, Field, IconAlert, IconBolt, IconCheck, IconLayers, IconLogout, IconSettings, IconShield, IconTerminal, IconX, Select, TextInput, useToast } from "../components/ui";

export default function Settings() {
  const { user, logout } = useAuth();
  const { push } = useToast();
  const [s, setS] = useState<SettingsRow>(() => getSettings(user!.id));
  const [diag, setDiag] = useState<DiagResult[] | null>(null);
  const [diagBusy, setDiagBusy] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const stats = useMemo(() => getStats(user!.id), [user, diag]);

  const save = (patch: Partial<SettingsRow>, msg = "Settings saved.") => {
    const next = saveSettings(user!.id, { ...s, ...patch });
    setS(next);
    push("ok", msg);
  };

  const toggleMarket = (id: MarketplaceId, on: boolean) => {
    const next = on ? [...new Set([...s.default_marketplaces, id])] : s.default_marketplaces.filter((m) => m !== id);
    save({ default_marketplaces: next });
  };

  const runDiag = () => {
    setDiagBusy(true);
    window.setTimeout(() => {
      setDiag(runDiagnostics());
      setDiagBusy(false);
    }, 350);
  };

  const doClear = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      window.setTimeout(() => setConfirmClear(false), 3000);
      return;
    }
    clearUserData(user!.id);
    setConfirmClear(false);
    setDiag(null);
    push("warn", "Workspace data cleared — searches, listings and cached translations removed.");
  };

  const passed = diag ? diag.filter((d) => d.pass).length : 0;

  return (
    <div className="mx-auto max-w-4xl px-5 py-10">
      <div className="mb-8 anim-rise">
        <p className="mb-1.5 font-mono text-[11.5px] font-semibold uppercase tracking-[0.2em] text-teal-400">workspace configuration</p>
        <h1 className="font-display text-[clamp(1.8rem,3.4vw,2.6rem)] font-extrabold tracking-tight text-fog-50">Settings</h1>
        <p className="mt-1.5 text-[13.5px] text-fog-400">
          Signed in as <span className="font-mono text-fog-200">{user!.email}</span> · changes apply to your next runs.
        </p>
      </div>

      <div className="space-y-6">
        {/* preferences */}
        <section className="panel anim-rise rounded-2xl p-6" style={{ animationDelay: "60ms" }}>
          <h2 className="mb-5 flex items-center gap-2.5 font-display text-[16px] font-bold text-fog-100">
            <IconSettings size={17} className="text-amber-400" /> Preferences
          </h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Default language" hint="translation target">
              <Select value={s.default_language} onChange={(e) => save({ default_language: e.target.value as SettingsRow["default_language"] })}>
                <option value="de">German (Deutsch)</option>
              </Select>
            </Field>
            <Field label="Results per page">
              <Select value={String(s.results_per_page)} onChange={(e) => save({ results_per_page: Number(e.target.value) })}>
                {[12, 24, 48, 96].map((n) => <option key={n} value={n}>{n}</option>)}
              </Select>
            </Field>
          </div>
          <div className="mt-5">
            <Field label="Default marketplaces" hint="pre-selected on the dashboard">
              <div className="grid gap-2 sm:grid-cols-3">
                {MARKETPLACE_LIST.map((m) => (
                  <Check key={m.id} checked={s.default_marketplaces.includes(m.id)} onChange={(v) => toggleMarket(m.id, v)} dotColor={m.color} label={m.short} />
                ))}
              </div>
            </Field>
          </div>
        </section>

        {/* engine */}
        <section className="panel anim-rise rounded-2xl p-6" style={{ animationDelay: "110ms" }}>
          <h2 className="mb-5 flex items-center gap-2.5 font-display text-[16px] font-bold text-fog-100">
            <IconBolt size={17} className="text-amber-400" /> Scraper engine
          </h2>
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Min delay (ms)" hint="between page requests">
              <TextInput type="number" min={100} step={50} value={s.request_delay_min}
                onChange={(e) => setS({ ...s, request_delay_min: Number(e.target.value) })}
                onBlur={() => save({ request_delay_min: Math.max(100, s.request_delay_min) })} />
            </Field>
            <Field label="Max delay (ms)">
              <TextInput type="number" min={200} step={50} value={s.request_delay_max}
                onChange={(e) => setS({ ...s, request_delay_max: Number(e.target.value) })}
                onBlur={() => save({ request_delay_max: Math.max(300, s.request_delay_max) })} />
            </Field>
            <Field label="Concurrency" hint="parallel sources">
              <Select value={String(s.concurrency)} onChange={(e) => save({ concurrency: Number(e.target.value) })}>
                <option value="1">1 — sequential</option>
                <option value="2">2</option>
                <option value="3">3 — all sources</option>
              </Select>
            </Field>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-ink-600/50 bg-ink-900/60 px-4 py-3.5">
            <div>
              <div className="text-[13.5px] font-bold text-fog-100">Demo mode <span className="font-mono text-[11px] text-fog-500">(SCRAPER_DEMO_MODE)</span></div>
              <p className="mt-0.5 text-[12px] leading-relaxed text-fog-500">
                Deterministic fixture engine — perfect for testing. Disable for live capture via the serverless scraping endpoint.
              </p>
            </div>
            <button
              onClick={() => save({ demo_mode: !s.demo_mode }, s.demo_mode ? "Live engine enabled for next runs." : "Demo mode enabled.")}
              className={`relative h-7 w-[52px] shrink-0 rounded-full border transition-all duration-200 ${s.demo_mode ? "border-amber-500/60 bg-amber-500/25" : "border-ok-500/60 bg-ok-500/20"}`}
              role="switch"
              aria-checked={s.demo_mode}
            >
              <span className={`absolute top-[3px] h-5 w-5 rounded-full transition-all duration-200 ${s.demo_mode ? "left-[26px] bg-amber-400" : "left-[3px] bg-ok-400"}`} />
            </button>
          </div>
          <p className="mt-3 flex items-start gap-2 text-[11.5px] leading-relaxed text-fog-600">
            <IconShield size={13} className="mt-0.5 shrink-0 text-fog-500" />
            The engine respects robots.txt in live mode, retries with exponential backoff and stops a source after repeated failures — other sources continue.
          </p>
        </section>

        {/* translation */}
        <section className="panel anim-rise rounded-2xl p-6" style={{ animationDelay: "160ms" }}>
          <h2 className="mb-5 flex items-center gap-2.5 font-display text-[16px] font-bold text-fog-100">
            <IconLayers size={17} className="text-amber-400" /> Translation
          </h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Provider">
              <Select value={s.translation_provider} onChange={(e) => save({ translation_provider: e.target.value as SettingsRow["translation_provider"] })}>
                {PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </Field>
            <Field label="Model">
              <TextInput value={s.translation_model} onChange={(e) => setS({ ...s, translation_model: e.target.value })} onBlur={() => save({ translation_model: s.translation_model })} />
            </Field>
          </div>
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-kj-400/25 bg-kj-400/[0.06] px-4 py-3 text-[12.5px] leading-relaxed text-fog-300">
            <IconShield size={15} className="mt-0.5 shrink-0 text-kj-400" />
            API keys (TRANSLATION_API_KEY) live only in server-side environment variables and are never shipped to the browser.
            Identical texts are translated once and served from the hash-indexed cache — currently{" "}
            <span className="font-mono font-semibold text-amber-400">{fmtInt(stats.translations)}</span> entries in your workspace.
          </div>
        </section>

        {/* diagnostics */}
        <section className="panel anim-rise rounded-2xl p-6" style={{ animationDelay: "210ms" }}>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2.5 font-display text-[16px] font-bold text-fog-100">
              <IconTerminal size={17} className="text-amber-400" /> Diagnostics
            </h2>
            <Btn variant="outline" size="sm" onClick={runDiag} loading={diagBusy}>Run offline test suite</Btn>
          </div>
          <p className="text-[12.5px] leading-relaxed text-fog-500">
            25+ assertions against fixture HTML — price &amp; currency parsing, URL normalization, three-tier dedup, JSON-LD / embedded-JSON / HTML
            extraction, translation and cache. No live website is contacted.
          </p>
          {diag && (
            <div className="anim-fade mt-4">
              <div className={`mb-3 flex items-center gap-2 font-mono text-[12.5px] font-bold ${passed === diag.length ? "text-ok-400" : "text-warn-400"}`}>
                {passed === diag.length ? <IconCheck size={15} /> : <IconAlert size={15} />}
                {passed}/{diag.length} passed
              </div>
              <div className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-ink-600/50 bg-ink-950/60 p-3 font-mono text-[11.5px]">
                {diag.map((d) => (
                  <div key={d.name} className="flex items-start gap-2.5">
                    <span className={d.pass ? "text-ok-400" : "text-err-400"}>{d.pass ? "✓" : "✗"}</span>
                    <span className="text-fog-300">{d.name}</span>
                    <span className="ml-auto hidden truncate pl-4 text-fog-600 sm:block">{d.detail}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* data & session */}
        <section className="panel anim-rise rounded-2xl p-6" style={{ animationDelay: "260ms" }}>
          <h2 className="mb-5 flex items-center gap-2.5 font-display text-[16px] font-bold text-fog-100">
            <IconShield size={17} className="text-amber-400" /> Data &amp; session
          </h2>
          <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              ["Listings", stats.listings], ["Searches", stats.searches], ["Runs", stats.runs], ["Cache", stats.translations],
            ].map(([k, v]) => (
              <div key={k as string} className="rounded-xl border border-ink-600/50 bg-ink-900/60 px-4 py-3">
                <div className="font-mono text-[20px] font-bold tabular-nums text-fog-50">{fmtInt(v as number)}</div>
                <div className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-fog-500">{k}</div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <Btn variant="danger" onClick={doClear}>
              {confirmClear ? <><IconAlert size={14} /> Click again to confirm</> : <><IconX size={14} /> Clear all my data</>}
            </Btn>
            <Btn variant="subtle" onClick={() => { logout(); }}>
              <IconLogout size={14} /> Sign out
            </Btn>
          </div>
          <p className="mt-4 text-[11.5px] leading-relaxed text-fog-600">
            All records are scoped to your user id (row-level isolation). In the cloud deployment the same rules are enforced by Supabase RLS policies.
          </p>
        </section>
      </div>
    </div>
  );
}
