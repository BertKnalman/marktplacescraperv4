import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { deleteSearch, getSettings, listSearches } from "../lib/db";
import { startScrape } from "../lib/engine";
import { fmtDateTime, fmtInt } from "../lib/util";
import { Btn, EmptyState, IconHistory, IconPlay, IconRefresh, IconSearch, IconTrash, MTag, useToast } from "../components/ui";

export default function Searches() {
  const { user } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const [refresh, setRefresh] = useState(0);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [rerunning, setRerunning] = useState<string | null>(null);

  const searches = useMemo(() => listSearches(user!.id), [user, refresh]);

  const rerun = async (id: string) => {
    const rec = searches.find((s) => s.id === id);
    if (!rec) return;
    setRerunning(id);
    try {
      await startScrape(user!, {
        query: rec.query,
        marketplaces: rec.marketplaces,
        location: rec.location,
        price_min: rec.price_min,
        price_max: rec.price_max,
        currency: rec.currency,
        pages: rec.pages,
        limit: rec.limit,
      }, getSettings(user!.id));
      push("ok", `Re-run finished for “${rec.query}”.`);
      setRefresh((n) => n + 1);
      navigate("/dashboard");
    } catch (err) {
      push("err", err instanceof Error ? err.message : "Could not re-run this search.");
    } finally {
      setRerunning(null);
    }
  };

  const remove = (id: string) => {
    if (confirmId !== id) {
      setConfirmId(id);
      window.setTimeout(() => setConfirmId((c) => (c === id ? null : c)), 2600);
      return;
    }
    deleteSearch(user!.id, id);
    setConfirmId(null);
    setRefresh((n) => n + 1);
    push("info", "Search and its listings were deleted.");
  };

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="anim-rise">
          <p className="mb-1.5 font-mono text-[11.5px] font-semibold uppercase tracking-[0.2em] text-teal-400">capture archive</p>
          <h1 className="font-display text-[clamp(1.8rem,3.4vw,2.6rem)] font-extrabold tracking-tight text-fog-50">Search History</h1>
        </div>
        <Link to="/dashboard">
          <Btn variant="outline"><IconSearch size={14} /> New capture</Btn>
        </Link>
      </div>

      {searches.length === 0 ? (
        <EmptyState
          icon={<IconHistory size={26} />}
          title="No searches yet"
          body="Every query you run is archived here with its sources, result count and status — ready to inspect or re-run."
          action={<Link to="/dashboard"><Btn><IconPlay size={14} /> Start scraping</Btn></Link>}
        />
      ) : (
        <div className="space-y-3">
          {searches.map((s, i) => (
            <div key={s.id} className="panel panel-hover anim-rise flex flex-wrap items-center gap-4 rounded-2xl p-4 sm:p-5" style={{ animationDelay: `${Math.min(i, 6) * 60}ms` }}>
              <div className="min-w-0 flex-1 basis-52">
                <div className="flex items-center gap-2.5">
                  <h2 className="truncate font-display text-[17px] font-bold text-fog-50">“{s.query}”</h2>
                  <span
                    className={`rounded-full px-2 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-widest ${
                      s.last_run_status === "completed" ? "bg-ok-500/10 text-ok-400" :
                      s.last_run_status === "running" ? "bg-warn-400/10 text-warn-400" :
                      s.last_run_status === "cancelled" ? "bg-ink-700 text-fog-400" : "bg-err-500/10 text-err-400"
                    }`}
                  >
                    {s.last_run_status ?? "—"}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-fog-500">
                  <span className="flex gap-1.5">{s.marketplaces.map((m) => <MTag key={m} id={m} size="sm" />)}</span>
                  <span className="font-mono">{fmtDateTime(s.created_at)}</span>
                  {s.location && <span>· {s.location}</span>}
                  <span>· {s.pages} pg · limit {s.limit}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-[22px] font-bold tabular-nums text-fog-50">{fmtInt(s.listing_count)}</div>
                <div className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-fog-500">results</div>
              </div>
              <div className="flex gap-2">
                <Link to={`/listings?search=${s.id}`}>
                  <Btn variant="outline" size="sm">View results</Btn>
                </Link>
                <Btn variant="subtle" size="sm" onClick={() => rerun(s.id)} loading={rerunning === s.id}>
                  <IconRefresh size={13} /> Run again
                </Btn>
                <Btn variant="danger" size="sm" onClick={() => remove(s.id)}>
                  {confirmId === s.id ? "Sure?" : <IconTrash size={13} />}
                </Btn>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
