import React from "react";
import { apiClient } from "@/App";
import { Settings, Database, Briefcase, ListTodo, AlertTriangle, RotateCcw, Save, Plus, Trash2, Edit3, X, Upload, Sparkles } from "lucide-react";
import { API } from "@/App";

export default function SuperAdmin({ job, onJobChanged }) {
  const [section, setSection] = React.useState("settings");

  const sections = [
    { id: "settings", label: "ROI Settings", icon: Settings },
    { id: "jobs", label: "Jobs", icon: Briefcase },
    { id: "tasks", label: "Tasks", icon: ListTodo },
    { id: "mistakes", label: "Common Mistakes", icon: AlertTriangle },
    { id: "danger", label: "Danger Zone", icon: RotateCcw },
  ];

  return (
    <div data-testid="super-admin">
      <div className="mb-6">
        <h2 className="font-display font-black text-3xl md:text-4xl uppercase tracking-tight">
          <span className="text-[#FF5F15]">►</span> Super Admin
        </h2>
        <p className="text-sm text-[#A1A1AA] mt-1">Edit anything. Tune the cost model. Burn it down and reseed.</p>
      </div>

      <div className="flex gap-1 mb-4 overflow-x-auto border-b border-[#27272A] -mx-1 px-1">
        {sections.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.id}
              data-testid={`admin-section-${s.id}`}
              onClick={() => setSection(s.id)}
              className={`flex items-center gap-2 px-4 py-3 whitespace-nowrap text-xs uppercase tracking-widest font-bold border-b-2 transition-colors ${
                section === s.id
                  ? "border-[#FF5F15] text-[#FF5F15]"
                  : "border-transparent text-[#A1A1AA] hover:text-[#FAFAFA]"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {s.label}
            </button>
          );
        })}
      </div>

      <div className="k-slide-up">
        {section === "settings" && <SettingsPanel />}
        {section === "jobs" && <JobsPanel job={job} onChanged={onJobChanged} />}
        {section === "tasks" && <TasksPanel job={job} />}
        {section === "mistakes" && <MistakesPanel />}
        {section === "danger" && <DangerPanel onReset={onJobChanged} />}
      </div>
    </div>
  );
}

/* ── SETTINGS ─────────────────────────────────────────────────── */
function SettingsPanel() {
  const [s, setS] = React.useState(null);
  const [saving, setSaving] = React.useState(false);
  const [savedAt, setSavedAt] = React.useState(null);

  React.useEffect(() => {
    apiClient.get("/settings").then((r) => setS(r.data));
  }, []);

  if (!s) return <div className="text-sm text-[#A1A1AA]">Loading settings…</div>;

  const save = async () => {
    setSaving(true);
    try {
      const r = await apiClient.patch("/settings", {
        rework_cost_per_check: parseFloat(s.rework_cost_per_check),
        photo_audit_value: parseFloat(s.photo_audit_value),
        company_name: s.company_name,
        ai_model: s.ai_model,
      });
      setS(r.data);
      setSavedAt(new Date().toLocaleTimeString());
    } catch (e) {
      alert("Save failed: " + e.message);
    }
    setSaving(false);
  };

  return (
    <div className="k-surface p-5 md:p-6 max-w-3xl">
      <h3 className="font-display font-bold uppercase text-xl text-[#CCFF00] mb-1">ROI Cost Model</h3>
      <p className="text-sm text-[#A1A1AA] mb-5">Drive the Rework Cost Saver tile. Tune these to your real numbers.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Rework Cost per Caught Check ($)" hint="Conservative industry default: $850. ICF blowouts can run $1,500+.">
          <input
            data-testid="settings-cost-per-check"
            type="number"
            step="50"
            className="k-input"
            value={s.rework_cost_per_check}
            onChange={(e) => setS({ ...s, rework_cost_per_check: e.target.value })}
          />
        </Field>
        <Field label="Photo Audit Value ($)" hint="Value of each captured photo as defensible audit trail.">
          <input
            data-testid="settings-photo-value"
            type="number"
            step="5"
            className="k-input"
            value={s.photo_audit_value}
            onChange={(e) => setS({ ...s, photo_audit_value: e.target.value })}
          />
        </Field>
        <Field label="Company Name">
          <input
            data-testid="settings-company"
            className="k-input"
            value={s.company_name}
            onChange={(e) => setS({ ...s, company_name: e.target.value })}
          />
        </Field>
        <Field label="AI Model" hint="Powering AI suggestions + fix-it guidance.">
          <select
            data-testid="settings-ai-model"
            className="k-select"
            value={s.ai_model}
            onChange={(e) => setS({ ...s, ai_model: e.target.value })}
          >
            <option value="claude-sonnet-4-6">Claude Sonnet 4.6 (recommended)</option>
            <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5 (faster)</option>
            <option value="claude-opus-4-7">Claude Opus 4.7 (heaviest)</option>
            <option value="gpt-5.4">GPT-5.4</option>
          </select>
        </Field>
      </div>

      <div className="flex items-center gap-3 mt-6">
        <button data-testid="settings-save-btn" onClick={save} disabled={saving} className="k-btn k-btn-primary">
          <Save className="w-4 h-4" /> {saving ? "Saving…" : "Save Settings"}
        </button>
        {savedAt && <span className="text-xs text-[#CCFF00] uppercase tracking-widest">Saved at {savedAt}</span>}
      </div>
    </div>
  );
}

/* ── JOBS ──────────────────────────────────────────────────────── */
function JobsPanel({ job, onChanged }) {
  const [jobs, setJobs] = React.useState([]);
  const [editing, setEditing] = React.useState(null);
  const [creating, setCreating] = React.useState(false);
  const [importing, setImporting] = React.useState(false);

  const load = async () => {
    const r = await apiClient.get("/jobs");
    setJobs(r.data);
  };

  React.useEffect(() => { load(); }, []);

  const save = async (j) => {
    await apiClient.patch(`/jobs/${j.id}`, {
      name: j.name,
      location: j.location,
      client: j.client,
      status: j.status,
      budget_hours: parseFloat(j.budget_hours) || 0,
    });
    setEditing(null);
    await load();
    onChanged?.();
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this job and all its tasks, validation steps, and entries?")) return;
    await apiClient.delete(`/jobs/${id}`);
    await load();
    onChanged?.();
  };

  const create = async (j) => {
    await apiClient.post("/jobs", {
      name: j.name,
      location: j.location || "",
      client: j.client || "",
      budget_hours: parseFloat(j.budget_hours) || 0,
    });
    setCreating(false);
    await load();
    onChanged?.();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <h3 className="font-display font-bold uppercase text-xl text-[#CCFF00]">Jobs Registry</h3>
        <div className="flex gap-2">
          <button data-testid="job-import-btn" onClick={() => setImporting(true)} className="k-btn text-xs">
            <Upload className="w-4 h-4" /> Import CSV / Excel
          </button>
          <button data-testid="job-create-btn" onClick={() => setCreating(true)} className="k-btn k-btn-primary text-xs">
            <Plus className="w-4 h-4" /> New Job
          </button>
        </div>
      </div>

      {importing && <ImportDialog onClose={() => setImporting(false)} onDone={async () => { await load(); onChanged?.(); setImporting(false); }} />}

      {creating && (
        <JobEditor onSave={create} onCancel={() => setCreating(false)} isNew />
      )}

      <div className="space-y-2">
        {jobs.map((j) => (
          editing === j.id ? (
            <JobEditor key={j.id} initial={j} onSave={save} onCancel={() => setEditing(null)} />
          ) : (
            <div key={j.id} className="k-surface p-4 flex items-center gap-3" data-testid={`admin-job-${j.id}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-display font-bold uppercase text-lg">{j.name}</span>
                  <span className={`k-pill k-pill-${j.status === "active" ? "in_progress" : j.status === "complete" ? "validated" : "not_started"}`}>{j.status}</span>
                </div>
                <div className="text-xs text-[#A1A1AA] font-mono">{j.location} · {j.client} · Budget: {j.budget_hours}h</div>
              </div>
              <button data-testid={`job-edit-${j.id}`} onClick={() => setEditing(j.id)} className="k-btn !p-2"><Edit3 className="w-4 h-4" /></button>
              <button data-testid={`job-delete-${j.id}`} onClick={() => remove(j.id)} className="k-btn !p-2 hover:!border-[#FF5F15]"><Trash2 className="w-4 h-4" /></button>
            </div>
          )
        ))}
      </div>
    </div>
  );
}

function JobEditor({ initial, onSave, onCancel, isNew }) {
  const [j, setJ] = React.useState(initial || { name: "", location: "", client: "", status: "active", budget_hours: 0 });
  return (
    <div className="k-surface p-4 mb-3 border-[#FF5F15]">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input data-testid="job-edit-name" className="k-input" placeholder="Job name" value={j.name} onChange={(e) => setJ({ ...j, name: e.target.value })} />
        <input data-testid="job-edit-client" className="k-input" placeholder="Client" value={j.client} onChange={(e) => setJ({ ...j, client: e.target.value })} />
        <input data-testid="job-edit-location" className="k-input" placeholder="Location" value={j.location} onChange={(e) => setJ({ ...j, location: e.target.value })} />
        <input data-testid="job-edit-budget" className="k-input" type="number" placeholder="Budget hours" value={j.budget_hours} onChange={(e) => setJ({ ...j, budget_hours: e.target.value })} />
        <select data-testid="job-edit-status" className="k-select" value={j.status} onChange={(e) => setJ({ ...j, status: e.target.value })}>
          <option>planning</option><option>active</option><option>paused</option><option>complete</option>
        </select>
      </div>
      <div className="flex gap-2 mt-3">
        <button data-testid="job-save-btn" className="k-btn k-btn-primary" onClick={() => onSave(j)}><Save className="w-4 h-4" /> {isNew ? "Create" : "Save"}</button>
        <button className="k-btn" onClick={onCancel}><X className="w-4 h-4" /> Cancel</button>
      </div>
    </div>
  );
}

/* ── TASKS ─────────────────────────────────────────────────────── */
function TasksPanel({ job }) {
  const [tasks, setTasks] = React.useState([]);
  const [search, setSearch] = React.useState("");
  const [editing, setEditing] = React.useState(null);
  const [creating, setCreating] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!job) return;
    const r = await apiClient.get(`/jobs/${job.id}/tasks`);
    setTasks(r.data);
  }, [job]);

  React.useEffect(() => { load(); }, [load]);

  const filtered = tasks.filter((t) => !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.category.toLowerCase().includes(search.toLowerCase()));

  const save = async (t) => {
    await apiClient.patch(`/tasks/${t.id}`, {
      name: t.name, category: t.category, course: t.course, unit: t.unit || null,
      estimated_hours: t.estimated_hours === "" ? null : parseFloat(t.estimated_hours),
      estimated_qty: t.estimated_qty === "" ? null : parseFloat(t.estimated_qty),
    });
    setEditing(null);
    load();
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this task plus its validation steps and entries?")) return;
    await apiClient.delete(`/tasks/${id}`);
    load();
  };

  const create = async (t) => {
    await apiClient.post(`/jobs/${job.id}/tasks`, {
      name: t.name, category: t.category, course: t.course || "all", unit: t.unit || null,
      estimated_hours: t.estimated_hours ? parseFloat(t.estimated_hours) : null,
      estimated_qty: t.estimated_qty ? parseFloat(t.estimated_qty) : null,
    });
    setCreating(false);
    load();
  };

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
        <h3 className="font-display font-bold uppercase text-xl text-[#CCFF00]">Tasks · {tasks.length} total</h3>
        <div className="flex gap-2 items-center">
          <input data-testid="admin-tasks-search" className="k-input !py-2" placeholder="Search task…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <button data-testid="task-create-btn" onClick={() => setCreating(true)} className="k-btn k-btn-primary"><Plus className="w-4 h-4" /></button>
        </div>
      </div>

      {creating && <TaskEditor onSave={create} onCancel={() => setCreating(false)} isNew />}

      <div className="space-y-1.5 max-h-[70vh] overflow-y-auto pr-1">
        {filtered.map((t) => (
          editing === t.id ? (
            <TaskEditor key={t.id} initial={t} onSave={save} onCancel={() => setEditing(null)} />
          ) : (
            <div key={t.id} className="k-surface p-3 flex items-center gap-3" data-testid={`admin-task-${t.id}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span className="text-[10px] font-mono text-[#FF5F15] uppercase tracking-widest">{t.category}</span>
                  {t.course !== "all" && <span className="text-[10px] font-mono text-[#A1A1AA] uppercase tracking-widest">{t.course}</span>}
                  {t.unit && <span className="text-[10px] font-mono text-[#A1A1AA] tracking-widest">{t.unit}</span>}
                </div>
                <div className="text-sm font-medium truncate">{t.name}</div>
                <div className="text-[10px] font-mono text-[#71717A]">est: {t.estimated_hours || "—"}h / {t.estimated_qty || "—"}{t.unit || ""}</div>
              </div>
              <button data-testid={`task-edit-${t.id}`} onClick={() => setEditing(t.id)} className="k-btn !p-2"><Edit3 className="w-3.5 h-3.5" /></button>
              <button data-testid={`task-delete-${t.id}`} onClick={() => remove(t.id)} className="k-btn !p-2 hover:!border-[#FF5F15]"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          )
        ))}
      </div>
    </div>
  );
}

function TaskEditor({ initial, onSave, onCancel, isNew }) {
  const [t, setT] = React.useState(initial || { name: "", category: "Install", course: "all", unit: "", estimated_hours: "", estimated_qty: "" });
  return (
    <div className="k-surface p-3 mb-2 border-[#FF5F15]">
      <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
        <input data-testid="task-edit-name" className="k-input md:col-span-3 !py-2" placeholder="Task name" value={t.name} onChange={(e) => setT({ ...t, name: e.target.value })} />
        <select data-testid="task-edit-category" className="k-select !py-2" value={t.category} onChange={(e) => setT({ ...t, category: e.target.value })}>
          {["Precon", "Startup", "Layout", "Install", "Rebar", "Pour", "Strip", "Cleanup", "Other"].map((c) => <option key={c}>{c}</option>)}
        </select>
        <select data-testid="task-edit-course" className="k-select !py-2" value={t.course} onChange={(e) => setT({ ...t, course: e.target.value })}>
          {["all", "1st", "2nd", "3rd", "4th", "5th"].map((c) => <option key={c}>{c}</option>)}
        </select>
        <select data-testid="task-edit-unit" className="k-select !py-2" value={t.unit || ""} onChange={(e) => setT({ ...t, unit: e.target.value })}>
          <option value="">unit…</option>
          <option>LF</option><option>SF</option><option>EA</option><option>HRS</option><option>%</option>
        </select>
        <input data-testid="task-edit-est-hours" className="k-input !py-2" type="number" step="0.5" placeholder="Est hrs" value={t.estimated_hours || ""} onChange={(e) => setT({ ...t, estimated_hours: e.target.value })} />
        <input data-testid="task-edit-est-qty" className="k-input !py-2" type="number" placeholder="Est qty" value={t.estimated_qty || ""} onChange={(e) => setT({ ...t, estimated_qty: e.target.value })} />
      </div>
      <div className="flex gap-2 mt-2">
        <button data-testid="task-save-btn" className="k-btn k-btn-primary !py-2" onClick={() => onSave(t)}><Save className="w-3.5 h-3.5" /> {isNew ? "Create" : "Save"}</button>
        <button className="k-btn !py-2" onClick={onCancel}><X className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  );
}

/* ── COMMON MISTAKES ───────────────────────────────────────────── */
function MistakesPanel() {
  const [items, setItems] = React.useState([]);
  const [creating, setCreating] = React.useState(false);
  const [draft, setDraft] = React.useState({ category: "Install", title: "", fix: "" });

  const load = async () => {
    const r = await apiClient.get("/common-mistakes");
    setItems(r.data);
  };
  React.useEffect(() => { load(); }, []);

  const add = async () => {
    if (!draft.title.trim() || !draft.fix.trim()) return;
    await apiClient.post("/common-mistakes", draft);
    setDraft({ category: draft.category, title: "", fix: "" });
    setCreating(false);
    load();
  };
  const remove = async (id) => {
    await apiClient.delete(`/common-mistakes/${id}`);
    load();
  };

  const grouped = items.reduce((acc, m) => {
    const k = m.category || "Other";
    acc[k] = acc[k] || [];
    acc[k].push(m);
    return acc;
  }, {});

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-display font-bold uppercase text-xl text-[#CCFF00]">Common Mistakes Library</h3>
        <button data-testid="mistake-add-btn" onClick={() => setCreating(!creating)} className="k-btn k-btn-primary text-xs"><Plus className="w-4 h-4" /> New</button>
      </div>

      {creating && (
        <div className="k-surface p-4 mb-3 border-[#FF5F15]">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
            <select data-testid="mistake-category" className="k-select" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
              {["Precon", "Startup", "Layout", "Install", "Rebar", "Pour", "Strip", "Cleanup", "Other"].map((c) => <option key={c}>{c}</option>)}
            </select>
            <input data-testid="mistake-title" className="k-input md:col-span-2" placeholder="Mistake title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </div>
          <textarea data-testid="mistake-fix" className="k-textarea" rows={2} placeholder="Fix-it guidance the crew sees" value={draft.fix} onChange={(e) => setDraft({ ...draft, fix: e.target.value })} />
          <button data-testid="mistake-save" onClick={add} className="k-btn k-btn-primary mt-2"><Save className="w-4 h-4" /> Save</button>
        </div>
      )}

      <div className="space-y-4">
        {Object.entries(grouped).map(([cat, list]) => (
          <div key={cat}>
            <div className="text-[10px] font-mono uppercase tracking-widest text-[#FF5F15] mb-2">{cat}</div>
            <div className="space-y-1.5">
              {list.map((m) => (
                <div key={m.id} className="k-surface p-3 flex items-start gap-3" data-testid={`mistake-${m.id}`}>
                  <AlertTriangle className="w-4 h-4 text-[#FF5F15] flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="font-medium">{m.title}</div>
                    <div className="text-sm text-[#A1A1AA] mt-1">{m.fix}</div>
                  </div>
                  <button data-testid={`mistake-delete-${m.id}`} onClick={() => remove(m.id)} className="k-btn !p-2"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── DANGER ZONE ───────────────────────────────────────────────── */
function DangerPanel({ onReset }) {
  const [working, setWorking] = React.useState(false);

  const doReset = async () => {
    if (!window.confirm("This wipes EVERYTHING and reseeds Walls Abilene. Continue?")) return;
    setWorking(true);
    await apiClient.post("/admin/reset?keep_settings=true");
    setWorking(false);
    onReset?.();
    alert("Reset complete.");
  };

  return (
    <div className="k-surface p-6 border-[#FF5F15] max-w-2xl">
      <h3 className="font-display font-bold uppercase text-xl text-[#FF5F15] mb-2">▲ Danger Zone</h3>
      <p className="text-sm text-[#A1A1AA] mb-5">Irreversible. Use only when you want a clean demo state.</p>

      <div className="border border-[#3F3F46] p-4 bg-[#09090B]">
        <div className="font-medium mb-1">Reset Everything & Reseed</div>
        <div className="text-xs text-[#A1A1AA] mb-3">Deletes all jobs, tasks, validation steps, entries, and common mistakes. Then re-seeds the Walls Abilene demo. Settings are kept.</div>
        <button data-testid="admin-reset-btn" onClick={doReset} disabled={working} className="k-btn !border-[#FF5F15] !text-[#FF5F15] hover:!bg-[#FF5F15] hover:!text-black">
          <RotateCcw className="w-4 h-4" /> {working ? "Resetting…" : "Reset & Reseed"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-widest text-[#A1A1AA] block mb-1.5 font-semibold">{label}</label>
      {children}
      {hint && <div className="text-[10px] text-[#71717A] mt-1">{hint}</div>}
    </div>
  );
}

/* ── IMPORT DIALOG (CSV / Excel + AI mapping) ─────────────────── */
function ImportDialog({ onClose, onDone }) {
  const [name, setName] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [client, setClient] = React.useState("");
  const [file, setFile] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [result, setResult] = React.useState(null);

  const submit = async () => {
    setError(null);
    if (!name.trim()) return setError("Job name is required");
    if (!file) return setError("Pick a CSV or Excel file");
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const q = new URLSearchParams({ name, location, client }).toString();
      const r = await fetch(`${API}/admin/import-file?${q}`, {
        method: "POST",
        body: fd,
      });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(t);
      }
      const data = await r.json();
      setResult(data);
    } catch (e) {
      setError(e.message || String(e));
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex justify-center items-start md:items-center p-4 overflow-y-auto">
      <div data-testid="import-dialog" className="bg-[#09090B] border-2 border-[#3F3F46] w-full max-w-lg k-slide-up">
        <div className="border-b border-[#3F3F46] p-5 flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-[#CCFF00] font-bold flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> AI-Assisted Import
            </div>
            <h2 className="font-display font-black text-2xl uppercase leading-tight mt-1">Import Tasks from CSV or Excel</h2>
            <p className="text-xs text-[#A1A1AA] mt-1">Drop in any ICF production spreadsheet. Claude reads it, maps rows to PLUMBLINE&apos;s task schema, and creates a new job.</p>
          </div>
          <button onClick={onClose} className="k-btn p-3"><X className="w-4 h-4" /></button>
        </div>

        {!result ? (
          <div className="p-5 space-y-4">
            <div>
              <label className="text-xs uppercase tracking-widest text-[#A1A1AA] block mb-1.5 font-semibold">Job Name *</label>
              <input data-testid="import-name" className="k-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Midland School District" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs uppercase tracking-widest text-[#A1A1AA] block mb-1.5 font-semibold">Location</label>
                <input data-testid="import-location" className="k-input" value={location} onChange={(e) => setLocation(e.target.value)} />
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest text-[#A1A1AA] block mb-1.5 font-semibold">Client</label>
                <input data-testid="import-client" className="k-input" value={client} onChange={(e) => setClient(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-[#A1A1AA] block mb-1.5 font-semibold">CSV or Excel File *</label>
              <label className="k-photo p-6 block cursor-pointer">
                <input
                  type="file"
                  data-testid="import-file"
                  accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={(e) => setFile(e.target.files?.[0])}
                  className="hidden"
                />
                {file ? (
                  <div className="text-sm text-[#FAFAFA]"><Upload className="inline w-4 h-4 mr-2" />{file.name} · {(file.size / 1024).toFixed(1)} KB</div>
                ) : (
                  <div className="flex items-center gap-2 justify-center"><Upload className="w-5 h-5" /><span>Tap to select CSV or .xlsx</span></div>
                )}
              </label>
              <div className="text-[10px] text-[#71717A] mt-2">Any layout works — Claude figures out the columns. Max 350 rows.</div>
            </div>
            {error && (
              <div className="k-surface-2 border-[#FF5F15] p-3 text-sm text-[#FF5F15]" data-testid="import-error">{error}</div>
            )}
            <div className="pt-2 border-t border-[#3F3F46]">
              <button data-testid="import-submit" onClick={submit} disabled={loading} className="k-btn k-btn-primary w-full">
                {loading ? "Analyzing spreadsheet with AI…" : "Import & Create Job"}
              </button>
              <div className="text-[10px] text-center text-[#A1A1AA] mt-2 uppercase tracking-widest">
                {loading ? "This can take 15–40 seconds depending on size" : "Powered by Claude Sonnet 4.6"}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-5 space-y-4" data-testid="import-success">
            <div className="text-[#CCFF00] font-display font-black text-3xl">✓ Import Complete</div>
            <div className="text-sm space-y-1">
              <div><span className="text-[#A1A1AA]">Rows parsed:</span> <span className="font-mono">{result.rows_parsed}</span></div>
              <div><span className="text-[#A1A1AA]">Tasks created:</span> <span className="font-mono text-[#CCFF00]">{result.tasks}</span></div>
              <div><span className="text-[#A1A1AA]">Job ID:</span> <span className="font-mono text-xs">{result.job_id}</span></div>
            </div>
            <button data-testid="import-done" onClick={onDone} className="k-btn k-btn-primary w-full">Done · View Jobs</button>
          </div>
        )}
      </div>
    </div>
  );
}
