import React from "react";
import { apiClient } from "@/App";
import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts";
import { AlertTriangle, CheckCircle2, Camera, Activity, TrendingUp, Users, ShieldCheck, DollarSign, Trophy, Medal, FileSpreadsheet, FileText } from "lucide-react";
import { API } from "@/App";
import CrewDrilldown from "@/components/CrewDrilldown";

export default function Dashboard({ job }) {
  const [data, setData] = React.useState(null);
  const [tick, setTick] = React.useState(0);
  const [drilldown, setDrilldown] = React.useState(null);

  React.useEffect(() => {
    const load = async () => {
      if (!job) return;
      const r = await apiClient.get(`/jobs/${job.id}/dashboard`);
      setData(r.data);
    };
    load();
    const id = setInterval(() => setTick(t => t + 1), 8000);
    return () => clearInterval(id);
  }, [job, tick]);

  if (!data) return <div className="text-slate-500 text-sm">Loading dashboard…</div>;

  const { totals, status_counts, daily_trend, validation_stats, category_breakdown, rework_tasks, active_crew, roi, leaderboard } = data;
  const ratio = totals.ratio;
  const ratioTone = ratio >= 1 ? "text-emerald-600" : ratio >= 0.85 ? "text-amber-600" : "text-red-600";

  const catData = Object.entries(category_breakdown).map(([k, v]) => ({ name: k, est: v.est_hours, actual: v.actual_hours })).filter(d => d.est > 0 || d.actual > 0);

  const statusData = [
    { name: "Done", value: status_counts.validated, color: "#10B981" },
    { name: "Active", value: status_counts.in_progress, color: "#2563EB" },
    { name: "Rework", value: status_counts.rework, color: "#EF4444" },
    { name: "Queued", value: status_counts.not_started, color: "#CBD5E1" },
  ];

  return (
    <div data-testid="dashboard-view" className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Command Dashboard</div>
          <h1 className="font-display font-extrabold text-2xl md:text-3xl tracking-tight text-slate-900">{job?.name}</h1>
        </div>
        <div className="flex gap-2">
          <a data-testid="export-xlsx" href={`${API}/jobs/${job?.id}/export/xlsx`} className="k-btn"><FileSpreadsheet className="w-4 h-4" /> Excel</a>
          <a data-testid="export-pdf" href={`${API}/jobs/${job?.id}/export/pdf`} className="k-btn"><FileText className="w-4 h-4" /> PDF</a>
        </div>
      </div>

      {/* Rework Cost Saver hero */}
      <div data-testid="rework-cost-saver" className="k-surface overflow-hidden">
        <div className="p-5 md:p-6 grid grid-cols-1 md:grid-cols-3 gap-5 items-center border-l-4 border-emerald-500">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span className="text-xs uppercase tracking-wide font-semibold text-emerald-600">Rework Cost Saver · Validation ROI</span>
            </div>
            <div className="font-display font-extrabold text-5xl md:text-6xl leading-none tracking-tight text-slate-900">
              ${(roi?.total_value_protected || 0).toLocaleString()}
            </div>
            <div className="text-sm text-slate-500 mt-2 max-w-lg leading-snug">
              Field-caught defects × {`$${roi?.cost_per_check}/check`} avoided + photo audit value.
              <span className="text-emerald-600 font-semibold"> Catching it now is 6–10× cheaper than post-pour.</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <RoiChip testid="roi-checks" label="Caught" value={roi?.checks_caught || 0} icon={<AlertTriangle className="w-3 h-3" />} />
            <RoiChip testid="roi-photos" label="Photos" value={roi?.photos_captured || validation_stats.photos_captured} icon={<Camera className="w-3 h-3" />} />
            <RoiChip testid="roi-saved" label="Saved" value={`$${((roi?.rework_dollars_saved || 0) / 1000).toFixed(1)}k`} icon={<DollarSign className="w-3 h-3" />} tone="text-emerald-600" />
          </div>
        </div>

        {roi?.trend_30d?.length > 0 && (
          <div data-testid="roi-trend-30d" className="border-t border-slate-200 p-4 md:p-5">
            <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-xs uppercase tracking-wide font-semibold text-slate-500">30-Day Cumulative Value Protected</span>
              </div>
              <div className="text-xs font-mono text-slate-500">
                Last 30 days · <span className="text-emerald-600 font-bold">${(roi.trend_30d[roi.trend_30d.length - 1]?.cumulative || 0).toLocaleString()}</span> running total
              </div>
            </div>
            <div className="h-32 md:h-36 min-w-0">
              <ResponsiveContainer width="100%" height="100%" minHeight={120}>
                <AreaChart data={roi.trend_30d} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="roiGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10B981" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="short" stroke="#94A3B8" tick={{ fontSize: 10 }} interval={4} />
                  <YAxis stroke="#94A3B8" tick={{ fontSize: 10 }} tickFormatter={(v) => v >= 1000 ? `$${(v/1000).toFixed(0)}k` : `$${v}`} width={48} />
                  <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 12 }} formatter={(value, name) => [`$${value.toLocaleString()}`, name === "cumulative" ? "Cumulative Saved" : "Daily Saved"]} labelFormatter={(label, payload) => payload?.[0]?.payload?.day_label || label} />
                  <Area type="monotone" dataKey="cumulative" stroke="#10B981" strokeWidth={2.5} fill="url(#roiGrad)" name="cumulative" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Hero metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <MetricTile testid="metric-ratio" label="Earned / Spent Ratio" value={ratio.toFixed(2)} tone={ratioTone} icon={<TrendingUp className="w-4 h-4" />} />
        <MetricTile testid="metric-earned" label="Earned Hours" value={totals.earned_hours} unit="hrs" icon={<CheckCircle2 className="w-4 h-4" />} />
        <MetricTile testid="metric-actual" label="Actual Hours" value={totals.actual_hours} unit="hrs" icon={<Activity className="w-4 h-4" />} />
        <MetricTile testid="metric-variance" label="Variance" value={totals.variance_hours} unit="hrs" tone={totals.variance_hours >= 0 ? "text-emerald-600" : "text-red-600"} icon={<TrendingUp className="w-4 h-4" />} />
      </div>

      {/* Status + Validation */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="k-surface p-5 lg:col-span-1">
          <SectionTitle>Task Status</SectionTitle>
          <div className="space-y-3 mt-4">
            {statusData.map((s) => {
              const total = statusData.reduce((a, b) => a + b.value, 0) || 1;
              const pct = (s.value / total) * 100;
              return (
                <div key={s.name}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="uppercase tracking-wide text-slate-500 font-medium">{s.name}</span>
                    <span className="font-mono font-bold text-slate-700">{s.value}</span>
                  </div>
                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden"><div style={{ width: `${pct}%`, background: s.color, height: "100%" }} className="rounded-full" /></div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="k-surface p-5 lg:col-span-2">
          <SectionTitle>Validation Layer · Live</SectionTitle>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            <MiniStat label="Checks Run" value={validation_stats.total} />
            <MiniStat label="Pass Rate" value={`${Math.round(validation_stats.pass_rate * 100)}%`} tone={validation_stats.pass_rate >= 0.95 ? "text-emerald-600" : "text-amber-600"} />
            <MiniStat label="Failed" value={validation_stats.failed} tone={validation_stats.failed > 0 ? "text-red-600" : ""} icon={<AlertTriangle className="w-3 h-3" />} />
            <MiniStat label="Photos Logged" value={validation_stats.photos_captured} icon={<Camera className="w-3 h-3" />} />
          </div>
        </div>
      </div>

      {/* Daily trend */}
      <div className="k-surface p-5">
        <SectionTitle>7-Day Production Trend</SectionTitle>
        <div className="h-64 mt-4 min-w-0">
          <ResponsiveContainer width="100%" height="100%" minHeight={240}>
            <LineChart data={daily_trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="day_label" stroke="#94A3B8" tick={{ fontSize: 12 }} />
              <YAxis stroke="#94A3B8" tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 8 }} />
              <Line type="monotone" dataKey="hours" stroke="#2563EB" strokeWidth={2.5} dot={{ fill: "#2563EB", r: 3 }} name="Hours" />
              <Line type="monotone" dataKey="qty" stroke="#10B981" strokeWidth={2.5} dot={{ fill: "#10B981", r: 3 }} name="Production" />
              <Line type="monotone" dataKey="failed_checks" stroke="#EF4444" strokeWidth={2} dot={{ fill: "#EF4444", r: 3 }} name="Failed Checks" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {catData.length > 0 && (
        <div className="k-surface p-5">
          <SectionTitle>Hours by Phase — Est vs Actual</SectionTitle>
          <div className="h-72 mt-4 min-w-0">
            <ResponsiveContainer width="100%" height="100%" minHeight={260}>
              <BarChart data={catData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="name" stroke="#94A3B8" tick={{ fontSize: 12 }} />
                <YAxis stroke="#94A3B8" tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 8 }} cursor={{ fill: "#F1F5F9" }} />
                <Bar dataKey="est" fill="#CBD5E1" name="Estimated" radius={[3, 3, 0, 0]} />
                <Bar dataKey="actual" fill="#2563EB" name="Actual" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Leaderboard */}
      {leaderboard && leaderboard.length > 0 && (
        <div data-testid="leaderboard" className="k-surface p-5">
          <SectionTitle><Trophy className="inline w-4 h-4 text-amber-500" /> Foreman Leaderboard · Validation Score</SectionTitle>
          <div className="mt-4 space-y-2">
            {leaderboard.slice(0, 8).map((p, idx) => {
              const medal = idx === 0 ? "text-amber-500" : idx === 1 ? "text-slate-400" : idx === 2 ? "text-orange-400" : "text-slate-300";
              const passColor = p.pass_rate >= 0.95 ? "text-emerald-600" : p.pass_rate >= 0.8 ? "text-amber-600" : "text-red-600";
              return (
                <button key={p.name} data-testid={`lb-row-${idx}`} onClick={() => setDrilldown(p.name)} className="k-surface-2 p-3 flex items-center gap-4 w-full text-left hover:border-blue-300 hover:bg-blue-50/40 transition-colors">
                  <div className={`font-display font-extrabold text-2xl w-9 text-center ${medal}`}>{idx + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-display font-bold text-slate-900">{p.name}</span>
                      <span className="text-[11px] uppercase tracking-wide text-slate-400 font-medium">{p.role}</span>
                      {idx === 0 && <Medal className="w-4 h-4 text-amber-500" />}
                    </div>
                    <div className="text-xs text-slate-500 font-mono mt-0.5">{p.hours}h · {p.entries} entries · {p.checks_total} checks</div>
                  </div>
                  <div className="text-right hidden sm:block">
                    <div className="text-[11px] uppercase tracking-wide text-slate-400">Pass Rate</div>
                    <div className={`font-display font-extrabold text-xl ${passColor}`}>{Math.round(p.pass_rate * 100)}%</div>
                  </div>
                  <div className="text-right hidden md:block">
                    <div className="text-[11px] uppercase tracking-wide text-slate-400">Catches</div>
                    <div className="font-display font-extrabold text-xl text-red-600">{p.checks_failed}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] uppercase tracking-wide text-slate-400">Score</div>
                    <div className="font-display font-extrabold text-xl text-slate-900">{p.score}</div>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="text-[11px] text-slate-400 mt-3 font-mono leading-snug">
            Score = pass-rate × 100 + ln(catches+1) × 12 + ln(photos+1) × 6 — rewards clean work AND catching defects in the field.
          </div>
        </div>
      )}

      {/* Rework + Crew */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="k-surface p-5">
          <SectionTitle><AlertTriangle className="inline w-4 h-4 text-red-500" /> Active Rework Flags</SectionTitle>
          {rework_tasks.length === 0 ? (
            <div className="text-sm text-slate-400 mt-4 py-6 text-center rounded-lg border border-dashed border-slate-300">No rework flagged. Crew is clean.</div>
          ) : (
            <ul data-testid="rework-list" className="mt-4 space-y-2">
              {rework_tasks.map((t) => (
                <li key={t.id} className="k-surface-2 p-3 flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="font-display font-bold text-slate-900 truncate">{t.name}</div>
                    <div className="text-xs text-slate-500 font-mono">{t.category} · {t.course} course</div>
                  </div>
                  <span className="k-pill k-pill-rework">FIX</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="k-surface p-5">
          <SectionTitle><Users className="inline w-4 h-4 text-slate-500" /> Crew on Site Today</SectionTitle>
          {active_crew.length === 0 ? (
            <div className="text-sm text-slate-400 mt-4">No entries logged yet.</div>
          ) : (
            <div className="flex flex-wrap gap-2 mt-4">
              {active_crew.map((c) => (
                <button key={c} onClick={() => setDrilldown(c)} data-testid={`crew-chip-${c}`} className="k-surface-2 px-3 py-2 text-sm font-medium text-slate-700 hover:border-blue-300 hover:bg-blue-50/40 transition-colors">{c}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      {drilldown && <CrewDrilldown jobId={job.id} crewName={drilldown} onClose={() => setDrilldown(null)} />}
    </div>
  );
}

function SectionTitle({ children }) {
  return <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500 font-semibold border-b border-slate-200 pb-2">{children}</div>;
}

function MetricTile({ testid, label, value, unit, tone, icon }) {
  return (
    <div data-testid={testid} className="k-surface k-metric">
      <div className="k-metric-label flex items-center gap-2 text-slate-400">{icon}{label}</div>
      <div className={`k-metric-value ${tone || ""}`}>{value}{unit && <span className="k-metric-unit">{unit}</span>}</div>
    </div>
  );
}

function MiniStat({ label, value, tone, icon }) {
  return (
    <div className="border-l-2 border-slate-200 pl-3">
      <div className="text-xs uppercase tracking-wide text-slate-400 flex items-center gap-1 font-medium">{icon}{label}</div>
      <div className={`font-display font-extrabold text-2xl mt-0.5 text-slate-900 ${tone || ""}`}>{value}</div>
    </div>
  );
}

function RoiChip({ testid, label, value, icon, tone }) {
  return (
    <div data-testid={testid} className="k-surface-2 p-3 text-center">
      <div className="text-[10px] uppercase tracking-wide text-slate-400 flex items-center justify-center gap-1 font-medium">{icon}{label}</div>
      <div className={`font-display font-extrabold text-xl md:text-2xl mt-0.5 ${tone || "text-slate-900"}`}>{value}</div>
    </div>
  );
}
