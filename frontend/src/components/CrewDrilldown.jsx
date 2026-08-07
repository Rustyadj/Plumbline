import React from "react";
import { apiClient } from "@/App";
import { X, Clock, Hash, AlertTriangle, Camera, TrendingUp } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts";

export default function CrewDrilldown({ jobId, crewName, onClose }) {
  const [data, setData] = React.useState(null);

  React.useEffect(() => {
    apiClient.get(`/jobs/${jobId}/crew/${encodeURIComponent(crewName)}/stats`).then((r) => setData(r.data));
  }, [jobId, crewName]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex justify-center p-0 md:p-4">
      <div className="bg-[#09090B] border-2 border-[#3F3F46] w-full max-w-4xl flex flex-col h-full md:max-h-[92vh] md:h-auto k-slide-up">
        {/* Header */}
        <div className="border-b border-[#3F3F46] p-5 flex items-start justify-between gap-4 flex-shrink-0">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-widest text-[#CCFF00] font-bold">Crew Drilldown</div>
            <h2 className="font-display font-black text-3xl md:text-4xl uppercase leading-tight">{crewName}</h2>
            {data?.role && <div className="text-xs font-mono uppercase tracking-widest text-[#A1A1AA] mt-1">{data.role}</div>}
          </div>
          <button data-testid="crew-close" onClick={onClose} className="k-btn p-3"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-6 overflow-y-auto flex-1 min-h-0">
          {!data ? (
            <div className="text-sm text-[#A1A1AA]">Loading…</div>
          ) : !data.found ? (
            <div className="k-surface p-8 text-center">
              <div className="font-display font-bold uppercase text-xl text-[#A1A1AA] mb-2">No entries yet</div>
              <div className="text-sm text-[#A1A1AA]">{crewName} hasn&apos;t logged production on this job.</div>
            </div>
          ) : (
            <>
              {/* Stats row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard testid="crew-hours" icon={<Clock className="w-3.5 h-3.5" />} label="Hours" value={data.stats.total_hours} />
                <StatCard testid="crew-entries" icon={<Hash className="w-3.5 h-3.5" />} label="Entries" value={data.stats.entries} />
                <StatCard testid="crew-pass-rate" icon={<TrendingUp className="w-3.5 h-3.5" />} label="Pass Rate" value={`${Math.round(data.stats.pass_rate * 100)}%`}
                  tone={data.stats.pass_rate >= 0.95 ? "text-[#CCFF00]" : data.stats.pass_rate >= 0.8 ? "text-[#F59E0B]" : "text-[#FF5F15]"} />
                <StatCard testid="crew-catches" icon={<AlertTriangle className="w-3.5 h-3.5" />} label="Catches" value={data.stats.checks_failed} tone="text-[#FF5F15]" />
              </div>

              {/* 14-day trend */}
              <div className="k-surface p-4">
                <div className="text-[10px] uppercase tracking-widest text-[#A1A1AA] mb-2 font-semibold">14-Day Activity</div>
                <div className="h-32 min-w-0">
                  <ResponsiveContainer width="100%" height="100%" minHeight={120}>
                    <AreaChart data={data.daily} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="crewG" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#FF5F15" stopOpacity={0.5} />
                          <stop offset="100%" stopColor="#FF5F15" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272A" vertical={false} />
                      <XAxis dataKey="day_label" stroke="#71717A" tick={{ fontSize: 10 }} />
                      <YAxis stroke="#71717A" tick={{ fontSize: 10 }} width={28} />
                      <Tooltip contentStyle={{ background: "#18181B", border: "1px solid #3F3F46", borderRadius: 2, fontSize: 12 }} />
                      <Area type="monotone" dataKey="hours" stroke="#FF5F15" strokeWidth={2.5} fill="url(#crewG)" name="Hours" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Task breakdown */}
              <section>
                <div className="text-[10px] uppercase tracking-widest text-[#CCFF00] font-bold mb-2">Top Tasks Worked</div>
                <div className="space-y-1.5">
                  {data.task_breakdown.map((t) => {
                    const maxH = data.task_breakdown[0]?.hours || 1;
                    const pct = (t.hours / maxH) * 100;
                    return (
                      <div key={t.task_id} className="k-surface-2 p-3" data-testid={`crew-task-${t.task_id}`}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="text-xs text-[#A1A1AA] font-mono uppercase tracking-widest">{t.category} · {t.course}</div>
                            <div className="font-medium truncate">{t.name}</div>
                          </div>
                          <div className="text-right font-mono">
                            <div className="font-display font-bold text-lg">{t.hours}h</div>
                            <div className="text-[10px] text-[#A1A1AA]">{t.entries} entries</div>
                          </div>
                        </div>
                        <div className="h-1 bg-[#27272A] mt-2"><div className="h-full bg-[#FF5F15]" style={{ width: `${pct}%` }} /></div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Recent entries */}
              <section>
                <div className="text-[10px] uppercase tracking-widest text-[#CCFF00] font-bold mb-2">Recent Entries</div>
                <div className="space-y-1.5">
                  {data.recent.map((r) => (
                    <div key={r.id} className="k-surface-2 p-3 flex items-start gap-3 text-sm" data-testid={`crew-entry-${r.id}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className="text-[10px] font-mono text-[#FF5F15] uppercase tracking-widest">{r.category}</span>
                          {r.has_failed_check && <span className="k-pill k-pill-rework">FLAG</span>}
                        </div>
                        <div className="font-medium truncate">{r.task_name}</div>
                        {r.notes && <div className="text-xs text-[#A1A1AA] mt-1">{r.notes}</div>}
                      </div>
                      <div className="text-right text-xs font-mono text-[#A1A1AA] flex-shrink-0">
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
      <div className="text-[10px] uppercase tracking-widest text-[#A1A1AA] flex items-center gap-1 font-semibold">{icon}{label}</div>
      <div className={`font-display font-black text-4xl mt-1 ${tone || "text-[#FAFAFA]"}`}>{value}</div>
    </div>
  );
}
