import React from "react";
import { ArrowDown, ArrowUp, Search } from "lucide-react";

export default function PhaseLedger({ phases }) {
  const [query, setQuery] = React.useState("");
  const [reworkOnly, setReworkOnly] = React.useState(false);
  const [sort, setSort] = React.useState({ key: "", direction: 1 });
  const rows = Object.entries(phases).map(([name, phase]) => ({
    name,
    ...phase,
  }));
  const filtered = rows.filter(
    (p) =>
      (!reworkOnly || p.rework > 0) &&
      p.name.toLowerCase().includes(query.toLowerCase()),
  );
  if (sort.key)
    filtered.sort(
      (a, b) =>
        sort.direction *
        (typeof a[sort.key] === "string"
          ? a[sort.key].localeCompare(b[sort.key])
          : a[sort.key] - b[sort.key]),
    );
  const columns = [
    ["name", "Phase"],
    ["total", "Tasks"],
    ["validated", "Validated"],
    ["rework", "Rework"],
    ["est_hours", "Est. hours"],
    ["actual_hours", "Actual hours"],
  ];
  return (
    <section aria-labelledby="phase-ledger-title" className="ledger-section">
      <div className="ledger-toolbar">
        <h2 id="phase-ledger-title">Phase ledger</h2>
        <div className="ledger-tools">
          <div className="ledger-tabs" aria-label="Phase filters">
            <button
              aria-pressed={!reworkOnly}
              onClick={() => setReworkOnly(false)}
            >
              All phases
            </button>
            <button
              aria-pressed={reworkOnly}
              onClick={() => setReworkOnly(true)}
            >
              Rework
            </button>
          </div>
          <label className="ledger-search">
            <Search size={15} />
            <input
              aria-label="Search phases"
              placeholder="Search phases…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>
      </div>
      <div
        className="ledger-scroll"
        tabIndex={0}
        role="region"
        aria-label="Phase ledger table"
      >
        <table className="ledger-table" data-testid="phase-ledger">
          <thead>
            <tr>
              {columns.map(([key, label]) => (
                <th
                  scope="col"
                  key={key}
                  aria-sort={
                    sort.key === key
                      ? sort.direction === 1
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                  className={key !== "name" ? "numeric" : ""}
                >
                  <button
                    onClick={() =>
                      setSort({
                        key,
                        direction: sort.key === key ? -sort.direction : 1,
                      })
                    }
                  >
                    {label}
                    {sort.key === key &&
                      (sort.direction === 1 ? (
                        <ArrowUp size={12} />
                      ) : (
                        <ArrowDown size={12} />
                      ))}
                  </button>
                </th>
              ))}
              <th scope="col">Completion</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const pct = p.total
                ? Math.round((p.validated / p.total) * 100)
                : 0;
              return (
                <tr key={p.name}>
                  <th scope="row">{p.name}</th>
                  <td className="numeric">{p.total}</td>
                  <td className="numeric">{p.validated}</td>
                  <td
                    className={`numeric ${p.rework ? "ledger-danger" : "ledger-muted"}`}
                  >
                    {p.rework || "—"}
                  </td>
                  <td className="numeric">
                    {p.est_hours.toLocaleString(undefined, {
                      maximumFractionDigits: 1,
                    })}
                  </td>
                  <td className="numeric">
                    {p.actual_hours.toLocaleString(undefined, {
                      maximumFractionDigits: 1,
                    })}
                  </td>
                  <td>
                    <div className="ledger-completion">
                      <span>{pct}%</span>
                      <div className="ledger-track" aria-hidden="true">
                        <div style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!filtered.length && (
          <p className="ledger-empty" role="status">
            No phases match these filters.
          </p>
        )}
      </div>
      <div className="ledger-table-footer">
        {filtered.length} of {rows.length} phases{" "}
        <span>Completion = validated tasks / total tasks</span>
      </div>
    </section>
  );
}
