import React from "react";
import { apiClient, API } from "@/App";
import { Settings, Briefcase, ListTodo, AlertTriangle, RotateCcw, Save, Plus, Trash2, Edit3, X, Upload, Check, Tag, Layers, Bot, KeyRound } from "lucide-react";

const CATEGORIES = ["Precon", "Startup", "Layout", "Install", "Rebar", "Pour", "Strip", "Cleanup", "Other"];
const COURSES = ["all", "1st", "2nd", "3rd", "4th", "5th"];
const UNITS = ["LF", "SF", "EA", "HRS", "%"];

const SECTION_META = {
  settings: { label: "ROI Settings", desc: "Tune the cost model that drives the Rework Cost Saver." },
  ai: { label: "AI Settings", desc: "Connect your own AI key and name your in-app assistant." },
  jobs: { label: "Jobs", desc: "Create, edit, import, and delete jobs." },
  tasks: { label: "Tasks", desc: "Bulk-select to re-categorize or remove tasks after import." },
  mistakes: { label: "Common Mistakes", desc: "Fix-it guidance the crew sees in the field." },
  danger: { label: "Danger Zone", desc: "Irreversible. Reset & reseed the demo." },
};

export default function SuperAdmin({ job, section = "jobs", onSection, onJobChanged, onJobImported }) {
  const meta = SECTION_META[section] || SECTION_META.jobs;
  return (
    <div data-testid="super-admin">
      <div className="mb-6">
        <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Super Admin</div>
        <h1 className="font-display font-extrabold text-2xl md:text-3xl tracking-tight text-slate-900">{meta.label}</h1>
        <p className="text-sm text-slate-500 mt-1">{meta.desc}</p>
      </div>

      <div className="k-slide-up">
        {section === "settings" && <SettingsPanel />}
        {section === "ai" && <AiSettingsPanel />}
        {section === "jobs" && <JobsPanel job={job} onChanged={onJobChanged} onImported={onJobImported} onGoTasks={() => onSection?.("tasks")} />}
        {section === "tasks" && <TasksPanel job={job} />}
        {section === "mistakes" && <MistakesPanel />}
        {section === "danger" && <DangerPanel onReset={onJobChanged} />}
      </div>
    </div>
  );
}

/* ── AI SETTINGS ──────────────────────────────────────────────── */
const AI_MODELS = {
  openai: ["gpt-5.4", "gpt-5.4-mini", "gpt-5.2", "gpt-4.1", "gpt-4o"],
  anthropic: ["claude-sonnet-4-6", "claude-opus-4-6", "claude-haiku-4-5-20251001", "claude-sonnet-4-5-20250929"],
  gemini: ["gemini-3.1-pro-preview", "gemini-3-flash-preview", "gemini-2.5-flash", "gemini-2.5-pro"],
};
const KEY_HELP = {
  openai: "platform.openai.com/api-keys",
  anthropic: "console.anthropic.com/settings/keys",
  gemini: "aistudio.google.com/apikey",
};

function AiSettingsPanel() {
  const [cur, setCur] = React.useState(null);
  const [provider, setProvider] = React.useState("openai");
  const [model, setModel] = React.useState("gpt-5.4");
  const [botName, setBotName] = React.useState("@titanicf_bot");
  const [apiKey, setApiKey] = React.useState("");
  const [saved, setSaved] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    const r = await apiClient.get("/ai-settings");
    setCur(r.data);
    setProvider(r.data.ai_provider || "openai");
    setModel(r.data.ai_model || "gpt-5.4");
    setBotName(r.data.bot_name || "@titanicf_bot");
  }, []);
  React.useEffect(() => { load(); }, [load]);

  const changeProvider = (p) => {
    setProvider(p);
    if (!AI_MODELS[p].includes(model)) setModel(AI_MODELS[p][0]);
  };

  const save = async () => {
    setSaving(true);
    const body = { ai_provider: provider, ai_model: model, bot_name: botName.trim() || "@titanicf_bot" };
    if (apiKey.trim()) body.ai_api_key = apiKey.trim();
    const r = await apiClient.post("/ai-settings", body);
    setCur(r.data);
    setApiKey("");
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  if (!cur) return <div className="text-sm text-slate-500">Loading…</div>;

  return (
    <div className="max-w-2xl space-y-5" data-testid="ai-settings-panel">
      <div className={`k-surface p-4 flex items-center gap-3 ${cur.has_key ? "border-emerald-300 bg-emerald-50" : "border-amber-300 bg-amber-50"}`}>
        <Bot className={`w-6 h-6 ${cur.has_key ? "text-emerald-600" : "text-amber-600"}`} />
        <div className="flex-1">
          <div className="font-display font-bold text-slate-900">{cur.bot_name} is {cur.has_key ? "connected" : "not connected"}</div>
          <div className="text-sm text-slate-600">
            {cur.has_key ? `Using ${cur.ai_provider} · ${cur.ai_model} · key ${cur.key_hint}` : "Paste your API key below to activate the assistant in the Live Feed."}
          </div>
        </div>
      </div>

      <div className="k-surface p-5 space-y-4">
        <div>
          <label className="text-[11px] uppercase tracking-wide text-slate-500 block mb-1 font-semibold">Assistant Handle</label>
          <input data-testid="ai-bot-name" className="k-input" value={botName} onChange={(e) => setBotName(e.target.value)} placeholder="@titanicf_bot" />
          <p className="text-xs text-slate-400 mt-1">Crews mention this handle in the Live Feed to talk to the AI.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] uppercase tracking-wide text-slate-500 block mb-1 font-semibold">Provider</label>
            <select data-testid="ai-provider" className="k-input" value={provider} onChange={(e) => changeProvider(e.target.value)}>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="gemini">Google Gemini</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wide text-slate-500 block mb-1 font-semibold">Model</label>
            <select data-testid="ai-model" className="k-input" value={model} onChange={(e) => setModel(e.target.value)}>
              {AI_MODELS[provider].map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="text-[11px] uppercase tracking-wide text-slate-500 block mb-1 font-semibold flex items-center gap-1"><KeyRound className="w-3.5 h-3.5" /> Your API Key</label>
          <input data-testid="ai-api-key" type="password" className="k-input font-mono" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={cur.has_key ? `Saved (${cur.key_hint}) — type to replace` : "sk-..."} />
          <p className="text-xs text-slate-400 mt-1">Stored securely on your backend. Get a key at <span className="text-blue-600">{KEY_HELP[provider]}</span></p>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button data-testid="ai-save-btn" onClick={save} disabled={saving} className="k-btn k-btn-primary"><Save className="w-4 h-4" /> {saving ? "Saving…" : "Save AI Settings"}</button>
          {saved && <span className="text-sm text-emerald-600 font-semibold flex items-center gap-1"><Check className="w-4 h-4" /> Saved</span>}
        </div>
      </div>
    </div>
  );
}

/* ── SETTINGS ─────────────────────────────────────────────────── */
function SettingsPanel() {
  const [s, setS] = React.useState(null);
  const [saving, setSaving] = React.useState(false);
  const [savedAt, setSavedAt] = React.useState(null);

  React.useEffect(() => { apiClient.get("/settings").then((r) => setS(r.data)); }, []);
  if (!s) return <div className="text-sm text-slate-500">Loading settings…</div>;

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
    } catch (e) { alert("Save failed: " + e.message); }
    setSaving(false);
  };

  return (
    <div className="k-surface p-5 md:p-6 max-w-3xl">
      <h3 className="font-display font-bold text-lg text-slate-900 mb-1">ROI Cost Model</h3>
      <p className="text-sm text-slate-500 mb-5">Drive the Rework Cost Saver tile. Tune these to your real numbers.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Rework Cost per Caught Check ($)" hint="Conservative industry default: $850. ICF blowouts can run $1,500+.">
          <input data-testid="settings-cost-per-check" type="number" step="50" className="k-input" value={s.rework_cost_per_check} onChange={(e) => setS({ ...s, rework_cost_per_check: e.target.value })} />
        </Field>
        <Field label="Photo Audit Value ($)" hint="Value of each captured photo as a defensible audit trail.">
          <input data-testid="settings-photo-value" type="number" step="5" className="k-input" value={s.photo_audit_value} onChange={(e) => setS({ ...s, photo_audit_value: e.target.value })} />
        </Field>
        <Field label="Company Name">
          <input data-testid="settings-company" className="k-input" value={s.company_name} onChange={(e) => setS({ ...s, company_name: e.target.value })} />
        </Field>
        <Field label="AI Model" hint="Powering AI suggestions + fix-it guidance.">
          <select data-testid="settings-ai-model" className="k-select" value={s.ai_model} onChange={(e) => setS({ ...s, ai_model: e.target.value })}>
            <option value="claude-sonnet-4-6">Claude Sonnet 4.6 (recommended)</option>
            <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5 (faster)</option>
            <option value="claude-opus-4-7">Claude Opus 4.7 (heaviest)</option>
            <option value="gpt-5.4">GPT-5.4</option>
          </select>
        </Field>
      </div>
      <div className="flex items-center gap-3 mt-6">
        <button data-testid="settings-save-btn" onClick={save} disabled={saving} className="k-btn k-btn-primary"><Save className="w-4 h-4" /> {saving ? "Saving…" : "Save Settings"}</button>
        {savedAt && <span className="text-xs text-emerald-600 font-medium">Saved at {savedAt}</span>}
      </div>
    </div>
  );
}

/* ── JOBS ──────────────────────────────────────────────────────── */
function JobsPanel({ job, onChanged, onImported, onGoTasks }) {
  const [jobs, setJobs] = React.useState([]);
  const [editing, setEditing] = React.useState(null);
  const [creating, setCreating] = React.useState(false);
  const [importing, setImporting] = React.useState(false);

  const load = async () => { const r = await apiClient.get("/jobs"); setJobs(r.data); };
  React.useEffect(() => { load(); }, []);

  const save = async (j) => {
    await apiClient.patch(`/jobs/${j.id}`, { name: j.name, location: j.location, client: j.client, status: j.status, budget_hours: parseFloat(j.budget_hours) || 0 });
    setEditing(null); await load(); onChanged?.();
  };
  const remove = async (id) => {
    if (!window.confirm("Delete this job and all its tasks, validation steps, and entries?")) return;
    await apiClient.delete(`/jobs/${id}`); await load(); onChanged?.();
  };
  const create = async (j) => {
    await apiClient.post("/jobs", { name: j.name, location: j.location || "", client: j.client || "", budget_hours: parseFloat(j.budget_hours) || 0 });
    setCreating(false); await load(); onChanged?.();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <h3 className="font-display font-bold text-lg text-slate-900">Jobs Registry <span className="text-slate-400 font-normal text-sm">· {jobs.length}</span></h3>
        <div className="flex gap-2">
          <button data-testid="job-import-btn" onClick={() => setImporting(true)} className="k-btn text-sm"><Upload className="w-4 h-4" /> Import CSV / Excel</button>
          <button data-testid="job-create-btn" onClick={() => setCreating(true)} className="k-btn k-btn-primary text-sm"><Plus className="w-4 h-4" /> New Job</button>
        </div>
      </div>

      {importing && <ImportDialog onClose={() => setImporting(false)} onDone={async (newJobId) => { await load(); if (newJobId) await onImported?.(newJobId); setImporting(false); onGoTasks?.(); }} />}
      {creating && <JobEditor onSave={create} onCancel={() => setCreating(false)} isNew />}

      {editing && <JobEditor key={editing} initial={jobs.find(j => j.id === editing)} onSave={save} onCancel={() => setEditing(null)} />}
      <div className="ledger-scroll" role="region" aria-label="Jobs registry" tabIndex={0}>
        <table className="ledger-table"><thead><tr><th scope="col">Job</th><th scope="col">Status</th><th scope="col">Location</th><th scope="col">Client</th><th scope="col" className="numeric">Budget hours</th><th scope="col">Actions</th></tr></thead>
          <tbody>{jobs.map(j => <tr key={j.id} data-testid={`admin-job-${j.id}`}>
            <th scope="row">{j.name}</th><td><span className={`k-pill k-pill-${j.status === "active" ? "in_progress" : j.status === "complete" ? "validated" : "not_started"}`}>{j.status}</span></td>
            <td>{j.location || "—"}</td><td>{j.client || "—"}</td><td className="numeric">{j.budget_hours}</td>
            <td><div className="flex gap-2"><button aria-label={`Edit ${j.name}`} data-testid={`job-edit-${j.id}`} onClick={() => setEditing(j.id)} className="k-btn !px-2 !py-2"><Edit3 className="w-4 h-4" /></button><button aria-label={`Delete ${j.name}`} data-testid={`job-delete-${j.id}`} onClick={() => remove(j.id)} className="k-btn k-btn-danger !px-2 !py-2"><Trash2 className="w-4 h-4" /></button></div></td>
          </tr>)}</tbody>
        </table>
        {!jobs.length && <p className="ledger-empty">No jobs yet. Create or import a job to begin.</p>}
      </div>
    </div>
  );
}

function JobEditor({ initial, onSave, onCancel, isNew }) {
  const [j, setJ] = React.useState(initial || { name: "", location: "", client: "", status: "active", budget_hours: 0 });
  return (
    <div className="k-surface p-4 mb-3 border-blue-300">
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

/* ── TASKS (bulk multi-select) ─────────────────────────────────── */
function TasksPanel({ job }) {
  const [tasks, setTasks] = React.useState([]);
  const [search, setSearch] = React.useState("");
  const [catFilter, setCatFilter] = React.useState("All");
  const [editing, setEditing] = React.useState(null);
  const [creating, setCreating] = React.useState(false);
  const [selected, setSelected] = React.useState(new Set());
  const [bulkCat, setBulkCat] = React.useState("Install");
  const [bulkCourse, setBulkCourse] = React.useState("all");
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!job) return;
    const r = await apiClient.get(`/jobs/${job.id}/tasks`);
    setTasks(r.data);
    setSelected(new Set());
  }, [job]);

  React.useEffect(() => { load(); }, [load]);

  const cats = ["All", ...CATEGORIES.filter((c) => tasks.some((t) => t.category === c))];
  const filtered = tasks.filter((t) => {
    if (catFilter !== "All" && t.category !== catFilter) return false;
    if (search && !(t.name.toLowerCase().includes(search.toLowerCase()) || t.category.toLowerCase().includes(search.toLowerCase()))) return false;
    return true;
  });

  const toggle = (id) => setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allVisibleOn = filtered.length > 0 && filtered.every((t) => selected.has(t.id));
  const toggleAll = () => setSelected((prev) => {
    const n = new Set(prev);
    if (allVisibleOn) filtered.forEach((t) => n.delete(t.id));
    else filtered.forEach((t) => n.add(t.id));
    return n;
  });

  const save = async (t) => {
    await apiClient.patch(`/tasks/${t.id}`, {
      name: t.name, category: t.category, course: t.course, unit: t.unit || null,
      estimated_hours: t.estimated_hours === "" ? null : parseFloat(t.estimated_hours),
      estimated_qty: t.estimated_qty === "" ? null : parseFloat(t.estimated_qty),
    });
    setEditing(null); load();
  };
  const remove = async (id) => {
    if (!window.confirm("Delete this task plus its validation steps and entries?")) return;
    await apiClient.delete(`/tasks/${id}`); load();
  };
  const create = async (t) => {
    await apiClient.post(`/jobs/${job.id}/tasks`, {
      name: t.name, category: t.category, course: t.course || "all", unit: t.unit || null,
      estimated_hours: t.estimated_hours ? parseFloat(t.estimated_hours) : null,
      estimated_qty: t.estimated_qty ? parseFloat(t.estimated_qty) : null,
    });
    setCreating(false); load();
  };

  const bulkCategory = async () => {
    setBusy(true);
    await apiClient.patch("/tasks/bulk/update", { task_ids: [...selected], category: bulkCat });
    setBusy(false); load();
  };
  const bulkCourseUpdate = async () => {
    setBusy(true);
    await apiClient.patch("/tasks/bulk/update", { task_ids: [...selected], course: bulkCourse });
    setBusy(false); load();
  };
  const bulkDelete = async () => {
    if (!window.confirm(`Delete ${selected.size} selected task(s)? This removes their validation steps and entries too.`)) return;
    setBusy(true);
    await apiClient.post("/tasks/bulk/delete", { task_ids: [...selected] });
    setBusy(false); load();
  };

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
        <h3 className="font-display font-bold text-lg text-slate-900">Tasks <span className="text-slate-400 font-normal text-sm">· {tasks.length} total</span></h3>
        <div className="flex gap-2 items-center">
          <input data-testid="admin-tasks-search" className="k-input !py-2 max-w-[220px]" placeholder="Search task…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <button data-testid="task-create-btn" onClick={() => setCreating(true)} className="k-btn k-btn-primary !px-2.5 !py-2"><Plus className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Category filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
        {cats.map((c) => (
          <button key={c} data-testid={`admin-cat-${c}`} onClick={() => setCatFilter(c)} className={`k-btn whitespace-nowrap !py-1.5 !px-3 text-xs ${catFilter === c ? "k-btn-primary" : ""}`}>
            {c}{c !== "All" ? ` · ${tasks.filter((t) => t.category === c).length}` : ` · ${tasks.length}`}
          </button>
        ))}
      </div>

      {creating && <TaskEditor onSave={create} onCancel={() => setCreating(false)} isNew />}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div data-testid="bulk-action-bar" className="sticky top-0 z-10 k-surface p-3 mb-3 border-blue-300 bg-blue-50/60 flex flex-wrap items-center gap-3 k-fade-in">
          <span className="text-sm font-semibold text-blue-800" data-testid="bulk-selected-count">{selected.size} selected</span>
          <div className="h-4 w-px bg-blue-200" />
          <div className="flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-slate-500" />
            <select data-testid="bulk-category-select" className="k-select !py-1.5 !text-sm !w-auto" value={bulkCat} onChange={(e) => setBulkCat(e.target.value)}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <button data-testid="bulk-category-apply" onClick={bulkCategory} disabled={busy} className="k-btn k-btn-primary !py-1.5 text-xs">Set Category</button>
          </div>
          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-slate-500" />
            <select data-testid="bulk-course-select" className="k-select !py-1.5 !text-sm !w-auto" value={bulkCourse} onChange={(e) => setBulkCourse(e.target.value)}>
              {COURSES.map((c) => <option key={c} value={c}>{c === "all" ? "Common" : `${c} course`}</option>)}
            </select>
            <button data-testid="bulk-course-apply" onClick={bulkCourseUpdate} disabled={busy} className="k-btn !py-1.5 text-xs">Set Course</button>
          </div>
          <div className="flex-1" />
          <button data-testid="bulk-delete" onClick={bulkDelete} disabled={busy} className="k-btn k-btn-danger !py-1.5 text-xs"><Trash2 className="w-3.5 h-3.5" /> Delete</button>
          <button data-testid="bulk-clear" onClick={() => setSelected(new Set())} className="k-btn !py-1.5 text-xs"><X className="w-3.5 h-3.5" /> Clear</button>
        </div>
      )}

      {/* Table */}
      <div className="k-surface overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
              <th className="px-3 py-2.5 w-10">
                <input type="checkbox" data-testid="select-all-tasks" checked={allVisibleOn} onChange={toggleAll} className="w-4 h-4 accent-blue-600 cursor-pointer" />
              </th>
              <th className="px-3 py-2.5">Task</th>
              <th className="px-3 py-2.5 w-28 hidden md:table-cell">Category</th>
              <th className="px-3 py-2.5 w-20 hidden md:table-cell">Course</th>
              <th className="px-3 py-2.5 w-28 hidden lg:table-cell">Est</th>
              <th className="px-3 py-2.5 w-20 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-10 text-center text-slate-400">No tasks match.</td></tr>
            )}
            {filtered.map((t) => (
              editing === t.id ? (
                <tr key={t.id}><td colSpan={6} className="p-0"><TaskEditor initial={t} onSave={save} onCancel={() => setEditing(null)} inline /></td></tr>
              ) : (
                <tr key={t.id} data-testid={`admin-task-${t.id}`} className={`border-b border-slate-100 last:border-0 transition-colors ${selected.has(t.id) ? "bg-blue-50/50" : "hover:bg-slate-50"}`}>
                  <td className="px-3 py-2.5">
                    <input type="checkbox" data-testid={`task-check-${t.id}`} checked={selected.has(t.id)} onChange={() => toggle(t.id)} className="w-4 h-4 accent-blue-600 cursor-pointer" />
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-slate-800 truncate max-w-[52vw] md:max-w-md">{t.name}</div>
                    <div className="md:hidden text-[11px] text-slate-400 mt-0.5">{t.category} · {t.course === "all" ? "common" : t.course}</div>
                  </td>
                  <td className="px-3 py-2.5 hidden md:table-cell">
                    <span className="k-pill k-pill-in_progress">{t.category}</span>
                  </td>
                  <td className="px-3 py-2.5 hidden md:table-cell text-slate-500 font-mono text-xs">{t.course === "all" ? "—" : t.course}</td>
                  <td className="px-3 py-2.5 hidden lg:table-cell text-slate-500 font-mono text-xs">{t.estimated_hours || "—"}h / {t.estimated_qty || "—"}{t.unit || ""}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-end gap-1">
                      <button data-testid={`task-edit-${t.id}`} onClick={() => setEditing(t.id)} className="k-btn !px-2 !py-1.5 !shadow-none"><Edit3 className="w-3.5 h-3.5" /></button>
                      <button data-testid={`task-delete-${t.id}`} onClick={() => remove(t.id)} className="k-btn k-btn-danger !px-2 !py-1.5 !shadow-none"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              )
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TaskEditor({ initial, onSave, onCancel, isNew, inline }) {
  const [t, setT] = React.useState(initial || { name: "", category: "Install", course: "all", unit: "", estimated_hours: "", estimated_qty: "" });
  return (
    <div className={`${inline ? "border-y border-blue-200 bg-blue-50/40" : "k-surface mb-2 border-blue-300"} p-3`}>
      <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
        <input data-testid="task-edit-name" className="k-input md:col-span-3 !py-2" placeholder="Task name" value={t.name} onChange={(e) => setT({ ...t, name: e.target.value })} />
        <select data-testid="task-edit-category" className="k-select !py-2" value={t.category} onChange={(e) => setT({ ...t, category: e.target.value })}>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select data-testid="task-edit-course" className="k-select !py-2" value={t.course} onChange={(e) => setT({ ...t, course: e.target.value })}>
          {COURSES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select data-testid="task-edit-unit" className="k-select !py-2" value={t.unit || ""} onChange={(e) => setT({ ...t, unit: e.target.value })}>
          <option value="">unit…</option>
          {UNITS.map((u) => <option key={u}>{u}</option>)}
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

  const load = async () => { const r = await apiClient.get("/common-mistakes"); setItems(r.data); };
  React.useEffect(() => { load(); }, []);

  const add = async () => {
    if (!draft.title.trim() || !draft.fix.trim()) return;
    await apiClient.post("/common-mistakes", draft);
    setDraft({ category: draft.category, title: "", fix: "" }); setCreating(false); load();
  };
  const remove = async (id) => { await apiClient.delete(`/common-mistakes/${id}`); load(); };

  const grouped = items.reduce((acc, m) => { const k = m.category || "Other"; (acc[k] = acc[k] || []).push(m); return acc; }, {});

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-display font-bold text-lg text-slate-900">Common Mistakes Library</h3>
        <button data-testid="mistake-add-btn" onClick={() => setCreating(!creating)} className="k-btn k-btn-primary text-sm"><Plus className="w-4 h-4" /> New</button>
      </div>

      {creating && (
        <div className="k-surface p-4 mb-3 border-blue-300">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
            <select data-testid="mistake-category" className="k-select" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
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
            <div className="text-xs font-semibold uppercase tracking-wide text-blue-600 mb-2">{cat}</div>
            <div className="space-y-1.5">
              {list.map((m) => (
                <div key={m.id} className="k-surface p-3 flex items-start gap-3" data-testid={`mistake-${m.id}`}>
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="font-medium text-slate-800">{m.title}</div>
                    <div className="text-sm text-slate-500 mt-1">{m.fix}</div>
                  </div>
                  <button data-testid={`mistake-delete-${m.id}`} onClick={() => remove(m.id)} className="k-btn k-btn-danger !px-2 !py-2"><Trash2 className="w-3.5 h-3.5" /></button>
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
    setWorking(false); onReset?.(); alert("Reset complete.");
  };
  return (
    <div className="k-surface p-6 border-red-200 max-w-2xl">
      <h3 className="font-display font-bold text-lg text-red-600 mb-2">Danger Zone</h3>
      <p className="text-sm text-slate-500 mb-5">Irreversible. Use only when you want a clean demo state.</p>
      <div className="rounded-xl border border-red-200 p-4 bg-red-50/50">
        <div className="font-semibold text-slate-900 mb-1">Reset Everything & Reseed</div>
        <div className="text-xs text-slate-500 mb-3">Deletes all jobs, tasks, validation steps, entries, and common mistakes, then re-seeds the Walls Abilene demo. Settings are kept.</div>
        <button data-testid="admin-reset-btn" onClick={doReset} disabled={working} className="k-btn k-btn-danger"><RotateCcw className="w-4 h-4" /> {working ? "Resetting…" : "Reset & Reseed"}</button>
      </div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-wide text-slate-500 block mb-1.5 font-semibold">{label}</label>
      {children}
      {hint && <div className="text-[11px] text-slate-400 mt-1">{hint}</div>}
    </div>
  );
}

/* ── IMPORT DIALOG (deterministic CSV/XLSX, full de-selectable table) ─── */
function ImportDialog({ onClose, onDone }) {
  const [step, setStep] = React.useState("upload");
  const [file, setFile] = React.useState(null);
  const [dragOver, setDragOver] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [preview, setPreview] = React.useState(null);
  const [selected, setSelected] = React.useState(new Set());
  const [name, setName] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [client, setClient] = React.useState("");
  const [budget, setBudget] = React.useState(0);
  const [filter, setFilter] = React.useState("All");
  const [search, setSearch] = React.useState("");
  const [commitResult, setCommitResult] = React.useState(null);

  const upload = async (f, overrides = {}) => {
    if (!f) return;
    setFile(f); setError(null); setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const qs = new URLSearchParams();
      if (overrides.task_col) qs.set("task_col", overrides.task_col);
      if (overrides.hours_col) qs.set("hours_col", overrides.hours_col);
      if (overrides.qty_col) qs.set("qty_col", overrides.qty_col);
      const qstr = qs.toString();
      const r = await fetch(`${API}/admin/import/preview${qstr ? "?" + qstr : ""}`, { method: "POST", body: fd });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      setPreview(data);
      setSelected(new Set(data.tasks.map((_, i) => i)));
      if (!name) setName(f.name.replace(/\.(csv|xlsx?|xls)$/i, ""));
      setStep("preview");
    } catch (e) { setError((e.message || "").slice(0, 300)); }
    setLoading(false);
  };

  const reparse = async (overrides) => upload(file, overrides);
  const onFileChange = (e) => upload(e.target.files?.[0]);
  const onDrop = (e) => { e.preventDefault(); setDragOver(false); upload(e.dataTransfer.files?.[0]); };

  const toggle = (i) => setSelected((prev) => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });
  const toggleAllInView = (visible, allOn) => setSelected((prev) => { const n = new Set(prev); for (const i of visible) allOn ? n.delete(i) : n.add(i); return n; });

  const commit = async () => {
    if (!name.trim()) return setError("Job name is required");
    if (selected.size === 0) return setError("Select at least one task");
    setStep("committing"); setError(null);
    try {
      const chosen = preview.tasks.filter((_, i) => selected.has(i));
      const r = await apiClient.post("/admin/import/commit", { name: name.trim(), location, client, budget_hours: parseFloat(budget) || 0, tasks: chosen });
      setCommitResult(r.data); setStep("done");
    } catch (e) { setError(e.response?.data?.detail || e.message); setStep("preview"); }
  };

  const filteredIdxs = React.useMemo(() => {
    if (!preview) return [];
    return preview.tasks.map((t, i) => ({ t, i })).filter(({ t }) => {
      if (filter !== "All" && t.category !== filter) return false;
      if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    }).map(({ i }) => i);
  }, [preview, filter, search]);

  const visibleAllOn = filteredIdxs.length > 0 && filteredIdxs.every((i) => selected.has(i));
  const cats = preview ? Object.keys(preview.stats.by_category).sort() : [];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-stretch md:items-start justify-center p-0 md:p-4 overflow-y-auto">
      <div data-testid="import-dialog" className="bg-white md:rounded-2xl border border-slate-200 w-full max-w-6xl md:my-4 flex flex-col min-h-full md:min-h-0 md:max-h-[94vh] shadow-2xl k-slide-up">
        {/* Header */}
        <div className="border-b border-slate-200 p-5 flex items-start justify-between gap-4 shrink-0">
          <div>
            <div className="text-xs uppercase tracking-wide text-blue-600 font-semibold">Instant Import · No AI Required</div>
            <h2 className="font-display font-extrabold text-xl md:text-2xl text-slate-900 mt-1">Import Tasks from CSV or Excel</h2>
            <p className="text-sm text-slate-500 mt-1">Drop in any spreadsheet — PLUMBLINE reads task names, auto-categorizes, and pulls estimates. Deselect anything not applicable before creating the job.</p>
          </div>
          <button data-testid="import-close" onClick={onClose} className="k-btn !px-2.5 !py-2"><X className="w-4 h-4" /></button>
        </div>

        {/* STEP 1: UPLOAD */}
        {step === "upload" && (
          <div className="p-5 md:p-8">
            <label onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={onDrop}
              className={`k-photo block cursor-pointer !min-h-[240px] ${dragOver ? "!border-blue-500 !bg-blue-50" : ""}`}>
              <input type="file" data-testid="import-file" accept=".csv,.xlsx,.xls,text/csv" onChange={onFileChange} className="hidden" />
              {loading ? (
                <div className="flex items-center gap-3 justify-center py-8"><RotateCcw className="w-5 h-5 animate-spin" /><span className="text-sm">Reading spreadsheet…</span></div>
              ) : (
                <div className="text-center py-8">
                  <Upload className="w-10 h-10 mx-auto mb-3 text-blue-500" />
                  <div className="font-display font-bold text-lg text-slate-900 mb-1">Drop CSV or Excel here</div>
                  <div className="text-sm text-slate-500">or tap to browse — .csv, .xlsx, .xls</div>
                </div>
              )}
            </label>
            {error && <div className="k-surface border-red-200 bg-red-50 p-3 text-sm text-red-700 mt-3" data-testid="import-error">{error}</div>}
            <div className="text-[11px] text-slate-400 mt-4 text-center leading-relaxed">
              <b className="text-slate-500">Auto-detected:</b> task name · category · course (1st–5th) · estimated hours & quantity · unit. Junk rows (totals, headers, employee names, #REF! errors) are skipped automatically.
            </div>
          </div>
        )}

        {/* STEP 2: PREVIEW */}
        {step === "preview" && preview && (
          <>
            <div className="border-b border-slate-200 p-4 grid grid-cols-2 md:grid-cols-5 gap-3 shrink-0">
              <Kpi label="Rows Scanned" value={preview.stats.rows_scanned} />
              <Kpi label="Tasks Found" value={preview.stats.tasks_found} tone="text-blue-600" />
              <Kpi label="Selected" value={selected.size} tone="text-emerald-600" testid="preview-selected-count" />
              <Kpi label="Categories" value={cats.length} />
              <Kpi label="Est. Hours" value={preview.tasks.filter((_, i) => selected.has(i)).reduce((a, t) => a + (t.estimated_hours || 0), 0).toFixed(0)} />
            </div>

            <ColumnOverride preview={preview} onOverride={reparse} loading={loading} />

            <div className="border-b border-slate-200 p-4 grid grid-cols-1 md:grid-cols-4 gap-3 shrink-0">
              <div><label className="text-[11px] uppercase tracking-wide text-slate-500 block mb-1 font-semibold">Job Name *</label><input data-testid="import-name" className="k-input !py-2" value={name} onChange={(e) => setName(e.target.value)} placeholder="Job name" /></div>
              <div><label className="text-[11px] uppercase tracking-wide text-slate-500 block mb-1 font-semibold">Location</label><input data-testid="import-location" className="k-input !py-2" value={location} onChange={(e) => setLocation(e.target.value)} /></div>
              <div><label className="text-[11px] uppercase tracking-wide text-slate-500 block mb-1 font-semibold">Client</label><input data-testid="import-client" className="k-input !py-2" value={client} onChange={(e) => setClient(e.target.value)} /></div>
              <div><label className="text-[11px] uppercase tracking-wide text-slate-500 block mb-1 font-semibold">Budget Hrs</label><input data-testid="import-budget" type="number" className="k-input !py-2" value={budget} onChange={(e) => setBudget(e.target.value)} /></div>
            </div>

            <div className="border-b border-slate-200 p-3 flex items-center gap-2 flex-wrap shrink-0">
              <input data-testid="import-search" placeholder="Search…" className="k-input !py-1.5 !text-sm max-w-[180px]" value={search} onChange={(e) => setSearch(e.target.value)} />
              <button data-testid="import-filter-All" onClick={() => setFilter("All")} className={`k-btn !py-1 !px-2.5 text-xs ${filter === "All" ? "k-btn-primary" : ""}`}>All · {preview.stats.tasks_found}</button>
              {cats.map((c) => (
                <button key={c} data-testid={`import-filter-${c}`} onClick={() => setFilter(c)} className={`k-btn !py-1 !px-2.5 text-xs ${filter === c ? "k-btn-primary" : ""}`}>{c} · {preview.stats.by_category[c]}</button>
              ))}
              <div className="flex-1" />
              <button data-testid="import-toggle-all" onClick={() => toggleAllInView(filteredIdxs, visibleAllOn)} className="k-btn !py-1 !px-2.5 text-xs">{visibleAllOn ? "Deselect Visible" : "Select Visible"}</button>
            </div>

            {/* Full de-selectable table */}
            <div className="overflow-y-auto flex-1 min-h-[240px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-50 border-b border-slate-200 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    <th className="px-3 py-2.5 w-10">
                      <input type="checkbox" data-testid="import-select-all" checked={visibleAllOn} onChange={() => toggleAllInView(filteredIdxs, visibleAllOn)} className="w-4 h-4 accent-blue-600 cursor-pointer" />
                    </th>
                    <th className="px-3 py-2.5">Task</th>
                    <th className="px-3 py-2.5 w-28 hidden md:table-cell">Category</th>
                    <th className="px-3 py-2.5 w-20 hidden md:table-cell">Course</th>
                    <th className="px-3 py-2.5 w-28 text-right">Est</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredIdxs.length === 0 && <tr><td colSpan={5} className="px-3 py-10 text-center text-slate-400">No tasks match this filter.</td></tr>}
                  {filteredIdxs.map((i) => {
                    const t = preview.tasks[i];
                    const on = selected.has(i);
                    return (
                      <tr key={i} data-testid={`import-task-${i}`} onClick={() => toggle(i)} className={`border-b border-slate-100 last:border-0 cursor-pointer transition-colors ${on ? "bg-blue-50/50" : "opacity-60 hover:opacity-100 hover:bg-slate-50"}`}>
                        <td className="px-3 py-2.5"><input type="checkbox" checked={on} onChange={() => toggle(i)} onClick={(e) => e.stopPropagation()} className="w-4 h-4 accent-blue-600 cursor-pointer" /></td>
                        <td className="px-3 py-2.5">
                          <div className="font-medium text-slate-800 truncate max-w-[52vw] md:max-w-lg">{t.name}</div>
                          <div className="md:hidden text-[11px] text-slate-400 mt-0.5">{t.category}{t.course !== "all" ? ` · ${t.course}` : ""}</div>
                        </td>
                        <td className="px-3 py-2.5 hidden md:table-cell"><span className="k-pill k-pill-in_progress">{t.category}</span></td>
                        <td className="px-3 py-2.5 hidden md:table-cell text-slate-500 font-mono text-xs">{t.course === "all" ? "—" : t.course}</td>
                        <td className="px-3 py-2.5 text-right text-slate-500 font-mono text-xs">{t.estimated_hours ? `${t.estimated_hours}h` : "—"}{t.estimated_qty ? ` / ${t.estimated_qty}${t.unit || ""}` : ""}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="border-t border-slate-200 p-4 flex items-center gap-3 shrink-0">
              {error && <div className="text-xs text-red-600 flex-1">{error}</div>}
              <button className="k-btn" onClick={() => { setStep("upload"); setPreview(null); setSelected(new Set()); setFile(null); }}>← Change File</button>
              <div className="flex-1" />
              <button data-testid="import-commit" onClick={commit} className="k-btn k-btn-primary" disabled={selected.size === 0 || !name.trim()}>
                Create Job with {selected.size} Task{selected.size === 1 ? "" : "s"} →
              </button>
            </div>
          </>
        )}

        {step === "committing" && (
          <div className="p-12 text-center"><RotateCcw className="w-8 h-8 mx-auto mb-3 animate-spin text-blue-500" /><div className="font-display font-bold text-lg text-slate-900">Creating Job & Tasks…</div></div>
        )}

        {step === "done" && commitResult && (
          <div className="p-8" data-testid="import-success">
            <div className="flex items-center gap-2 text-emerald-600 font-display font-extrabold text-2xl mb-3"><Check className="w-7 h-7" /> Import Complete</div>
            <div className="text-sm space-y-1 mb-6 text-slate-600">
              <div><span className="text-slate-400">Job created:</span> <span className="font-mono text-slate-900">{name}</span></div>
              <div><span className="text-slate-400">Tasks imported:</span> <span className="font-mono text-emerald-600 font-bold">{commitResult.tasks}</span></div>
            </div>
            <button data-testid="import-done" onClick={() => onDone(commitResult.job_id)} className="k-btn k-btn-primary w-full">Done · Review Tasks</button>
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, tone, testid }) {
  return (
    <div data-testid={testid}>
      <div className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">{label}</div>
      <div className={`font-display font-extrabold text-2xl ${tone || "text-slate-900"}`}>{value}</div>
    </div>
  );
}

/* ── COLUMN OVERRIDE ─────────────────────────────────────────── */
function ColumnOverride({ preview, onOverride, loading }) {
  const sheetNames = React.useMemo(() => Object.keys(preview.sheets || {}), [preview]);
  const [sheet, setSheet] = React.useState(sheetNames[0] || "");
  const detected = preview.detected_columns?.[sheet] || {};
  const cols = preview.sheets?.[sheet] || [];
  const [taskCol, setTaskCol] = React.useState(detected.task_column || "");
  const [hoursCol, setHoursCol] = React.useState(detected.hours_column || "");
  const [qtyCol, setQtyCol] = React.useState(detected.qty_column || "");
  const [expanded, setExpanded] = React.useState(false);

  React.useEffect(() => {
    const d = preview.detected_columns?.[sheet] || {};
    setTaskCol(d.task_column || ""); setHoursCol(d.hours_column || ""); setQtyCol(d.qty_column || "");
  }, [sheet, preview]);

  const apply = () => onOverride({ task_col: taskCol || undefined, hours_col: hoursCol || undefined, qty_col: qtyCol || undefined });

  return (
    <div className="border-b border-slate-200 shrink-0" data-testid="column-override">
      <button onClick={() => setExpanded(!expanded)} className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-slate-50 transition-colors" data-testid="column-override-toggle">
        <div className="flex items-center gap-2 text-xs">
          <span className="uppercase tracking-wide font-semibold text-slate-500">Detected Columns</span>
          <span className="font-mono text-slate-700">
            Task: <b className="text-blue-600">{detected.task_column || "—"}</b>
            <span className="text-slate-400"> · Hrs: </span><b>{detected.hours_column || "—"}</b>
            <span className="text-slate-400"> · Qty: </span><b>{detected.qty_column || "—"}</b>
          </span>
        </div>
        <span className="text-xs uppercase tracking-wide text-blue-600 font-semibold">{expanded ? "Hide" : "Wrong? Override →"}</span>
      </button>

      {expanded && (
        <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-3">
          {sheetNames.length > 1 && (
            <div>
              <label className="text-[11px] uppercase tracking-wide text-slate-500 block mb-1 font-semibold">Sheet</label>
              <select data-testid="override-sheet" className="k-select !py-2 !text-sm" value={sheet} onChange={(e) => setSheet(e.target.value)}>
                {sheetNames.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <ColPicker testid="override-task" label="Task Name Column *" value={taskCol} onChange={setTaskCol} cols={cols} />
            <ColPicker testid="override-hours" label="Hours Column" value={hoursCol} onChange={setHoursCol} cols={cols} allowNone />
            <ColPicker testid="override-qty" label="Quantity Column" value={qtyCol} onChange={setQtyCol} cols={cols} allowNone />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button data-testid="override-apply" onClick={apply} disabled={loading || !taskCol} className="k-btn k-btn-primary text-xs">
              <RotateCcw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />{loading ? "Reparsing…" : "Reparse with these columns"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ColPicker({ testid, label, value, onChange, cols, allowNone }) {
  return (
    <div>
      <label className="text-[11px] uppercase tracking-wide text-slate-500 block mb-1 font-semibold">{label}</label>
      <select data-testid={testid} className="k-select !py-2 !text-sm" value={value} onChange={(e) => onChange(e.target.value)}>
        {allowNone && <option value="">— None —</option>}
        {!allowNone && !value && <option value="">Pick a column…</option>}
        {cols.map((c) => {
          const samples = c.samples.length ? ` — ${c.samples.slice(0, 2).join(" / ")}` : "";
          return <option key={c.index} value={c.header}>{c.header}{samples}</option>;
        })}
      </select>
    </div>
  );
}
