import React from "react";
import { apiClient } from "@/App";
import { X, Clock, Hash, AlertTriangle, TrendingUp } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts";

export default function CrewDrilldown({ jobId, crewName, onClose }) {
  const [data, setData] = React.useState(null);

  React.useEffect(() => {
    apiClient.get(`/jobs/${jobId}/crew/${encodeURIComponent(crewName)}/stats`).then((r) => setData(r.data));
  }, [jobId, crewName]);

  React.useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex justify-center p-0 md:p-4" onClick={onClose}>
      <div
        className="bg-white border border-slate-200 md:rounded-2xl w-full max-w-4xl flex flex-col h-full md:max-h-[92vh] md:h-auto shadow-2xl k-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-slate-200 p-5 flex items-start justify-between gap-4 shrink-0">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wide text-blue-600 font-semibold">Crew Drilldown</div>
            <h2 className="font-display font-extrabold text-2xl md:text-3xl text-slate-900 leading-tight mt-1">{crewName}</h2>
            {data?.role && <div className="text-xs text-slate-500 mt-1">{data.role}</div>}
          </div>
          <button data-testid="crew-close" onClick={onClose} className="k-btn !px-2.5 !py-2"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-6 overflow-y-auto flex-1 min-h-0 bg-[#F8FAFC]">
          {!data ? (
            <div className="text-sm text-slate-500">Loading…</div>
          ) : !data.found ? (
            <div className="k-surface p-8 text-center">
              <div className="font-display font-bold text-xl text-slate-700 mb-2">No entries yet</div>
              <div className="text-sm text-slate-500">{crewName} hasn&apos;t logged production on this job.</div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard testid="crew-hours" icon={<Clock className="w-3.5 h-3.5" />} label="Hours" value={data.stats.total_hours} />
                <StatCard testid="crew-entries" icon={<Hash className="w-3.5 h-3.5" />} label="Entries" value={data.stats.entries} />
                <StatCard testid="crew-pass-rate" icon={<TrendingUp className="w-3.5 h-3.5" />} label="Pass Rate" value={`${Math.round(data.stats.pass_rate * 100)}%`}
                  tone={data.stats.pass_rate >= 0.95 ? "text-emerald-600" : data.stats.pass_rate >= 0.8 ? "text-amber-600" : "text-red-600"} />
                <StatCard testid="crew-catches" icon={<AlertTriangle className="w-3.5 h-3.5" />} label="Catches" value={data.stats.checks_failed} tone="text-red-600" />
              </div>

              <div className="k-surface p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500 mb-2 font-semibold">14-Day Activity</div>
                <div className="h-32 min-w-0">
                  <ResponsiveContainer width="100%" height="100%" minHeight={120}>
                    <AreaChart data={data.daily} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="crewG" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#2563EB" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#2563EB" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                      <XAxis dataKey="day_label" stroke="#94A3B8" tick={{ fontSize: 10 }} />
                      <YAxis stroke="#94A3B8" tick={{ fontSize: 10 }} width={28} />
                      <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 12 }} />
                      <Area type="monotone" dataKey="hours" stroke="#2563EB" strokeWidth={2.5} fill="url(#crewG)" name="Hours" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <section>
                <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold mb-2">Top Tasks Worked</div>
                <div className="space-y-1.5">
                  {data.task_breakdown.map((t) => {
                    const maxH = data.task_breakdown[0]?.hours || 1;
                    const pct = (t.hours / maxH) * 100;
                    return (
                      <div key={t.task_id} className="k-surface-2 p-3" data-testid={`crew-task-${t.task_id}`}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="text-[11px] text-slate-500 font-medium uppercase tracking-wide">{t.category} · {t.course}</div>
                            <div className="font-medium truncate text-slate-800">{t.name}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-display font-bold text-lg text-slate-900">{t.hours}h</div>
                            <div className="text-[10px] text-slate-500">{t.entries} entries</div>
                          </div>
                        </div>
                        <div className="h-1.5 bg-slate-200 rounded-full mt-2 overflow-hidden"><div className="h-full bg-blue-600 rounded-full" style={{ width: `${pct}%` }} /></div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section>
                <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold mb-2">Recent Entries</div>
                <div className="space-y-1.5">
                  {data.recent.map((r) => (
                    <div key={r.id} className="k-surface-2 p-3 flex items-start gap-3 text-sm" data-testid={`crew-entry-${r.id}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className="text-[11px] font-medium text-blue-600 uppercase tracking-wide">{r.category}</span>
                          {r.has_failed_check && <span className="k-pill k-pill-rework">FLAG</span>}
                        </div>
                        <div className="font-medium truncate text-slate-800">{r.task_name}</div>
                        {r.notes && <div className="text-xs text-slate-500 mt-1">{r.notes}</div>}
                      </div>
                      <div className="text-right text-xs text-slate-500 shrink-0 font-mono">
                        <div>{r.hours}h · {r.qty_completed}</div>
                        <div className="text-[10px] mt-0.5">{r.validations_count} checks · {r.photos_count} 📷</div>
                        <div className="text-[10px] mt-0.5">{(r.created_at || "").slice(0, 10)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ testid, label, value, tone, icon }) {
  return (
    <div data-testid={testid} className="k-surface p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500 flex items-center gap-1 font-semibold">{icon}{label}</div>
      <div className={`font-display font-extrabold text-3xl mt-1 ${tone || "text-slate-900"}`}>{value}</div>
    </div>
  );
}
