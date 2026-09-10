import React from "react";
import { apiClient, API } from "@/App";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { FileSpreadsheet, FileText, ArrowUpRight } from "lucide-react";
import CrewDrilldown from "@/components/CrewDrilldown";
import PhaseLedger from "@/components/PhaseLedger";

const money = (value) => `$${(value || 0).toLocaleString()}`;

export default function Dashboard({ job }) {
  const [data, setData] = React.useState(null);
  const [error, setError] = React.useState("");
  const [drilldown, setDrilldown] = React.useState(null);
  const jobId = job?.id;
  React.useEffect(() => {
    setData(null);
    setError("");
    setDrilldown(null);
    if (!jobId) return;
    const controller = new AbortController();
    const load = async () => {
      try {
        const r = await apiClient.get(`/jobs/${jobId}/dashboard`, {
          signal: controller.signal,
        });
        if (!controller.signal.aborted) {
          setData(r.data);
          setError("");
        }
      } catch (e) {
        if (!controller.signal.aborted)
          setError("Dashboard could not refresh. Retrying automatically.");
      }
    };
    load();
    const id = setInterval(load, 8000);
    return () => {
      controller.abort();
      clearInterval(id);
    };
  }, [jobId]);

  if (!job)
    return (
      <p className="ledger-empty">
        Select or create a job to view its dashboard.
      </p>
    );
  if (!data)
    return (
      <p role="status" className="ledger-empty">
        {error || "Loading dashboard…"}
      </p>
    );
  const {
    totals,
    status_counts,
    daily_trend,
    validation_stats,
    category_breakdown,
    rework_tasks,
    active_crew,
    roi,
    leaderboard = [],
  } = data;
  const ratioTone =
    totals.ratio >= 1
      ? "ledger-success"
      : totals.ratio >= 0.85
        ? "ledger-warning"
        : "ledger-danger";
  return (
    <div data-testid="dashboard-view" className="ledger-dashboard">
      <div className="ledger-page-heading">
        <div>
          <h1>{job.name}</h1>
          <p>Command Dashboard</p>
        </div>
        <div className="flex gap-2">
          <a
            data-testid="export-xlsx"
            href={`${API}/jobs/${job.id}/export/xlsx`}
            className="k-btn"
          >
            <FileSpreadsheet size={16} /> Excel
          </a>
          <a
            data-testid="export-pdf"
            href={`${API}/jobs/${job.id}/export/pdf`}
            className="k-btn"
          >
            <FileText size={16} /> PDF
          </a>
        </div>
      </div>
      {error && (
        <p role="status" className="ledger-danger">
          {error}
        </p>
      )}
      <section
        data-testid="rework-cost-saver"
        className="ledger-roi"
        aria-label="Validation return on investment"
      >
        <div className="ledger-roi-value">
          <h2>
            Rework Cost Saver <span>/ Validation ROI</span>
          </h2>
          <div className="ledger-money">
            {money(roi?.total_value_protected)}
          </div>
          <p>
            Field-caught defects × {money(roi?.cost_per_check)}/check avoided +
            photo audit value.
          </p>
        </div>
        {roi?.trend_30d?.length > 0 && (
          <div data-testid="roi-trend-30d" className="ledger-roi-chart">
            <h3>30-Day Cumulative Value Protected</h3>
            <div style={{ height: 112 }}>
              <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 300, height: 112 }}>
                <LineChart
                  data={roi.trend_30d}
                  margin={{ top: 10, right: 5, bottom: 0, left: 0 }}
                >
                  <CartesianGrid vertical={false} stroke="#e3e3db" />
                  <XAxis
                    dataKey="short"
                    tick={{ fontSize: 10 }}
                    minTickGap={35}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v) => `$${v / 1000}k`}
                    width={38}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: 0, fontSize: 12 }}
                    formatter={(v) => [money(v), "Cumulative value"]}
                  />
                  <Line
                    dataKey="cumulative"
                    stroke="#bd402b"
                    dot={false}
                    strokeWidth={1.5}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        <div className="ledger-roi-stats">
          <RoiStat
            testid="roi-checks"
            label="Caught"
            value={roi?.checks_caught || 0}
          />
          <RoiStat
            testid="roi-photos"
            label="Photos"
            value={roi?.photos_captured ?? validation_stats.photos_captured}
          />
          <RoiStat
            testid="roi-saved"
            label="Saved"
            value={`$${((roi?.rework_dollars_saved || 0) / 1000).toFixed(1)}k`}
          />
        </div>
      </section>
      <div className="ledger-metrics">
        <Metric
          testid="metric-ratio"
          label="Earned / Spent Ratio"
          value={totals.ratio.toFixed(2)}
          tone={ratioTone}
        />
        <Metric
          testid="metric-earned"
          label="Earned Hours"
          value={totals.earned_hours}
          unit="hrs"
        />
        <Metric
          testid="metric-actual"
          label="Actual Hours"
          value={totals.actual_hours}
          unit="hrs"
        />
        <Metric
          testid="metric-variance"
          label="Variance"
          value={totals.variance_hours}
          unit="hrs"
          tone={totals.variance_hours >= 0 ? "ledger-success" : "ledger-danger"}
        />
      </div>
      <PhaseLedger key={jobId} phases={category_breakdown} />
      <div className="ledger-two-column">
        <section className="ledger-section">
          <div className="ledger-toolbar">
            <h2>Active Rework Flags</h2>
            <span className="ledger-count">{rework_tasks.length}</span>
          </div>
          <div
            className="ledger-scroll"
            tabIndex={0}
            role="region"
            aria-label="Rework flags"
          >
            <table className="ledger-table" data-testid="rework-list">
              <thead>
                <tr>
                  <th scope="col">Task</th>
                  <th scope="col">Phase</th>
                  <th scope="col">Course</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {rework_tasks.map((t) => (
                  <tr key={t.id}>
                    <th scope="row">{t.name}</th>
                    <td>{t.category}</td>
                    <td>{t.course === "all" ? "Common" : t.course}</td>
                    <td>
                      <span className="k-pill k-pill-rework">FIX</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rework_tasks.length && (
              <p className="ledger-empty">No rework flagged. Crew is clean.</p>
            )}
          </div>
        </section>
        <section data-testid="leaderboard" className="ledger-section">
          <div className="ledger-toolbar">
            <h2>Foreman Leaderboard</h2>
            <span className="ledger-label">Validation score</span>
          </div>
          <div
            className="ledger-scroll"
            tabIndex={0}
            role="region"
            aria-label="Foreman leaderboard"
          >
            <table className="ledger-table">
              <thead>
                <tr>
                  <th scope="col">Foreman</th>
                  <th scope="col" className="numeric">
                    Hours
                  </th>
                  <th scope="col" className="numeric">
                    Pass rate
                  </th>
                  <th scope="col" className="numeric">
                    Catches
                  </th>
                  <th scope="col" className="numeric">
                    Score
                  </th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.slice(0, 8).map((p, i) => (
                  <tr key={p.name}>
                    <th scope="row">
                      <button
                        className="ledger-person"
                        data-testid={`lb-row-${i}`}
                        onClick={() => setDrilldown(p.name)}
                      >
                        <span className="ledger-rank">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        {p.name}
                        <ArrowUpRight size={13} />
                      </button>
                    </th>
                    <td className="numeric">{p.hours}</td>
                    <td className="numeric">
                      {Math.round(p.pass_rate * 100)}%
                    </td>
                    <td className="numeric">{p.checks_failed}</td>
                    <td className="numeric">{p.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!leaderboard.length && (
              <p className="ledger-empty">No crew entries logged yet.</p>
            )}
          </div>
          <p className="ledger-footnote">
            Score rewards clean work and catching defects in the field.
          </p>
        </section>
      </div>
      <div className="ledger-two-column ledger-health">
        <section>
          <div className="ledger-toolbar">
            <h2>Task Status</h2>
          </div>
          <dl className="ledger-status-list">
            {[
              ["Done", "validated"],
              ["Active", "in_progress"],
              ["Rework", "rework"],
              ["Queued", "not_started"],
            ].map(([label, key]) => (
              <div key={key}>
                <dt>
                  <span className={`k-pill k-pill-${key}`}>{label}</span>
                </dt>
                <dd>{status_counts[key]}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section>
          <div className="ledger-toolbar">
            <h2>Validation Layer</h2>
          </div>
          <dl className="ledger-status-list">
            {[
              ["Checks Run", validation_stats.total],
              ["Pass Rate", `${Math.round(validation_stats.pass_rate * 100)}%`],
              ["Failed", validation_stats.failed],
              ["Photos Logged", validation_stats.photos_captured],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
      <section className="ledger-section">
        <div className="ledger-toolbar">
          <h2>7-Day Production Trend</h2>
        </div>
        <div
          className="ledger-scroll"
          tabIndex={0}
          role="region"
          aria-label="Daily production"
        >
          <table className="ledger-table">
            <thead>
              <tr>
                <th scope="col">Day</th>
                <th scope="col" className="numeric">
                  Hours
                </th>
                <th scope="col" className="numeric">
                  Production
                </th>
                <th scope="col" className="numeric">
                  Failed Checks
                </th>
              </tr>
            </thead>
            <tbody>
              {daily_trend.map((d) => (
                <tr key={d.day_label}>
                  <th scope="row">{d.day_label}</th>
                  <td className="numeric">{d.hours}</td>
                  <td className="numeric">{d.qty}</td>
                  <td
                    className={`numeric ${d.failed_checks ? "ledger-danger" : ""}`}
                  >
                    {d.failed_checks}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="ledger-crew">
        <h2>Crew on Site Today</h2>
        <div className="flex flex-wrap gap-2">
          {active_crew.length ? (
            active_crew.map((c) => (
              <button
                key={c}
                onClick={() => setDrilldown(c)}
                data-testid={`crew-chip-${c}`}
                className="k-btn"
              >
                {c}
                <ArrowUpRight size={14} />
              </button>
            ))
          ) : (
            <p className="ledger-muted">No entries logged yet.</p>
          )}
        </div>
      </section>
      {drilldown && (
        <CrewDrilldown
          jobId={job.id}
          crewName={drilldown}
          onClose={() => setDrilldown(null)}
        />
      )}
    </div>
  );
}
function Metric({ testid, label, value, unit, tone = "" }) {
  return (
    <div data-testid={testid}>
      <div className="ledger-label">{label}</div>
      <div className={`ledger-metric-value ${tone}`}>
        {value}
        {unit && <span>{unit}</span>}
      </div>
    </div>
  );
}
function RoiStat({ testid, label, value }) {
  return (
    <div data-testid={testid}>
      <div className="ledger-label">{label}</div>
      <div className="ledger-roi-number">{value}</div>
    </div>
  );
}
