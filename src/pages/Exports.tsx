import { useMemo, useState } from "react";
import { useAuth } from "../lib/auth";
import { getStats, listExports, queryListings } from "../lib/db";
import { exportListings } from "../lib/export";
import { fmtDateTime, fmtInt } from "../lib/util";
import { Btn, EmptyState, IconDoc, IconDownload, useToast } from "../components/ui";

export default function Exports() {
  const { user } = useAuth();
  const { push } = useToast();
  const [refresh, setRefresh] = useState(0);
  const stats = useMemo(() => getStats(user!.id), [user, refresh]);
  const history = useMemo(() => listExports(user!.id), [user, refresh]);

  const doExport = (format: "csv" | "json") => {
    const rows = queryListings(user!.id, { sort: "newest", page: 1, per_page: 100000 }).rows;
    if (rows.length === 0) {
      push("warn", "Your workspace has no listings to export yet.");
      return;
    }
    const { filename, count } = exportListings(user!.id, rows, format, "workspace");
    setRefresh((n) => n + 1);
    push("ok", `Export ready — ${count} listings → ${filename}`);
  };

  return (
    <div className="mx-auto max-w-4xl px-5 py-10">
      <div className="mb-8 anim-rise">
        <p className="mb-1.5 font-mono text-[11.5px] font-semibold uppercase tracking-[0.2em] text-teal-400">take your data with you</p>
        <h1 className="font-display text-[clamp(1.8rem,3.4vw,2.6rem)] font-extrabold tracking-tight text-fog-50">Exports</h1>
      </div>

      <div className="panel anim-rise mb-6 rounded-2xl p-6" style={{ animationDelay: "60ms" }}>
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div>
            <h2 className="font-display text-[18px] font-bold text-fog-50">Full workspace dump</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-fog-400">
              <span className="font-mono font-semibold text-amber-400">{fmtInt(stats.listings)}</span> listings · both original and German
              titles &amp; descriptions, prices, URLs, locations and timestamps. Downloads instantly in your browser.
            </p>
          </div>
          <div className="flex gap-3">
            <Btn onClick={() => doExport("csv")}><IconDownload size={15} /> Export CSV</Btn>
            <Btn variant="outline" onClick={() => doExport("json")}><IconDownload size={15} /> Export JSON</Btn>
          </div>
        </div>
        <p className="mt-4 font-mono text-[10.5px] text-fog-600">
          CSV columns: marketplace · url · title_original · title_german · description_original · description_german · price · currency · location · published_at · …
        </p>
      </div>

      <div className="panel anim-rise rounded-2xl p-6" style={{ animationDelay: "120ms" }}>
        <h2 className="mb-4 font-display text-[16px] font-bold text-fog-100">Export history</h2>
        {history.length === 0 ? (
          <EmptyState
            icon={<IconDoc size={26} />}
            title="No exports yet"
            body="Every download is logged here with format, row count and filename."
          />
        ) : (
          <div className="divide-y divide-ink-700/60">
            {history.map((e) => (
              <div key={e.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                <span className={`rounded-md px-2 py-0.5 font-mono text-[10.5px] font-bold uppercase tracking-wider ${e.format === "csv" ? "bg-teal-500/15 text-teal-400" : "bg-ric-500/15 text-ric-400"}`}>
                  {e.format}
                </span>
                <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-fog-200">{e.filename}</span>
                <span className="font-mono text-[11.5px] tabular-nums text-fog-400">{fmtInt(e.count)} rows</span>
                <span className="font-mono text-[11px] text-fog-600">{fmtDateTime(e.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
