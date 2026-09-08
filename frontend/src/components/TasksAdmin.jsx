import React from "react";
import { apiClient } from "@/App";
import { Sparkles, Check, X, Plus, Trash2, Camera, ChevronDown, Ruler, Edit3, Save } from "lucide-react";

export default function TasksAdmin({ job, role, query = "" }) {
  const [tasks, setTasks] = React.useState([]);
  const [filter, setFilter] = React.useState("All");
  const [openId, setOpenId] = React.useState(null);

  React.useEffect(() => {
    if (!job) return;
    apiClient.get(`/jobs/${job.id}/tasks`).then((r) => setTasks(r.data));
  }, [job]);

  const filtered = tasks.filter((t) => {
    if (filter !== "All" && t.category !== filter) return false;
    if (query && !t.name.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  const categories = ["All", ...Array.from(new Set(tasks.map(t => t.category)))];

  return (
    <div data-testid="tasks-admin">
      <div className="mb-5">
        <h1 className="font-display font-extrabold text-2xl md:text-3xl tracking-tight text-slate-900">Validation Rules</h1>
        <p className="text-sm text-slate-500 mt-1">
          {role === "manager"
            ? "Generate AI validation steps, review, and approve — the safety net the crew uses in the field."
            : "Read-only view — your manager configures validation rules here."}
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
        {categories.map((c) => (
          <button
            key={c}
            data-testid={`admin-filter-${c}`}
            onClick={() => setFilter(c)}
            className={`k-btn whitespace-nowrap !py-1.5 !px-3 text-xs ${filter === c ? "k-btn-primary" : ""}`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="rules-register">
        <div className="rules-row rules-header" aria-hidden="true"><span>Task</span><span>Phase</span><span>Course</span><span>Rules</span><span /></div>
        {filtered.length === 0 && <div className="k-surface p-8 text-center text-sm text-slate-400">No tasks match.</div>}
        {filtered.map((t) => (
          <TaskAdminRow key={t.id} task={t} isOpen={openId === t.id} onToggle={() => setOpenId(openId === t.id ? null : t.id)} role={role} />
        ))}
      </div>
    </div>
  );
}

function TaskAdminRow({ task, isOpen, onToggle, role }) {
  const [steps, setSteps] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [genLoading, setGenLoading] = React.useState(false);
  const [adding, setAdding] = React.useState(false);
  const [editId, setEditId] = React.useState(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    const r = await apiClient.get(`/tasks/${task.id}/validation-steps`);
    setSteps(r.data);
    setLoading(false);
  }, [task.id]);

  React.useEffect(() => { if (isOpen) load(); }, [isOpen, load]);

  const generate = async () => {
    setGenLoading(true);
    try {
      await apiClient.post(`/tasks/${task.id}/validation-steps/generate`);
      await load();
    } catch (e) {
      alert("AI generation failed: " + (e.response?.data?.detail || e.message));
    }
    setGenLoading(false);
  };

  const approve = async (id) => { await apiClient.patch(`/validation-steps/${id}`, { approved: true }); load(); };
  const reject = async (id) => { await apiClient.delete(`/validation-steps/${id}`); load(); };

  const addManual = async (d) => {
    if (!d.description.trim()) return;
    await apiClient.post(`/tasks/${task.id}/validation-steps`, {
      description: d.description.trim(),
      tolerance: d.tolerance.trim() || null,
      spec_reference: d.spec_reference.trim() || null,
      requires_measurement: d.requires_measurement,
      unit: d.unit.trim() || null,
      requires_photo: d.requires_photo,
      source: "manual", approved: true,
    });
    setAdding(false); load();
  };

  const saveEdit = async (id, d) => {
    await apiClient.patch(`/validation-steps/${id}`, {
      description: d.description.trim(),
      tolerance: d.tolerance.trim() || "",
      spec_reference: d.spec_reference.trim() || "",
      requires_measurement: d.requires_measurement,
      unit: d.unit.trim() || "",
      requires_photo: d.requires_photo,
    });
    setEditId(null); load();
  };

  const approved = steps.filter(s => s.approved);
  const suggested = steps.filter(s => !s.approved);

  return (
    <div className="k-surface overflow-hidden">
      <button data-testid={`admin-row-${task.id}`} aria-expanded={isOpen} onClick={onToggle} className="rules-row">
        <span className="rules-row-name">{task.name}<span className="field-mobile-meta">{task.category} · {task.course === "all" ? "Common" : `${task.course} course`}</span></span>
        <span className="rules-desktop ledger-muted">{task.category}</span>
        <span className="rules-desktop ledger-muted">{task.course === "all" ? "Common" : `${task.course} course`}</span>
        <span className="rules-desktop ledger-muted">{steps.length ? `${approved.length} approved` : "View rules"}</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="border-t border-slate-200 p-4 space-y-4 bg-[#f7f6f2] k-slide-up">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-display font-bold text-sm text-slate-900">Approved Validation Rules</h4>
              {role === "manager" && (
                <button data-testid={`gen-ai-${task.id}`} onClick={generate} disabled={genLoading} className="k-btn text-xs !py-1.5">
                  <Sparkles className="w-3.5 h-3.5" />{genLoading ? "Generating…" : "Generate AI Suggestions"}
                </button>
              )}
            </div>
            {loading && <div className="text-sm text-slate-500">Loading…</div>}
            {!loading && approved.length === 0 && <div className="text-sm text-slate-500 p-3 rounded-lg border border-dashed border-slate-300 bg-white">No approved rules yet.</div>}
            <ul className="space-y-1.5">
              {approved.map((s) => (
                editId === s.id ? (
                  <li key={s.id}><RuleEditor initial={s} onSave={(d) => saveEdit(s.id, d)} onCancel={() => setEditId(null)} /></li>
                ) : (
                  <li key={s.id} className="k-surface p-3 flex items-start gap-3" data-testid={`approved-step-${s.id}`}>
                    <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-slate-800">{s.description}</div>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {s.tolerance && <span className="k-pill k-pill-in_progress" data-testid={`step-tol-${s.id}`}>Tol: {s.tolerance}</span>}
                        {s.spec_reference && <span className="k-pill k-pill-not_started">Spec: {s.spec_reference}</span>}
                        {s.requires_measurement && <span className="k-pill k-pill-validated"><Ruler className="inline w-3 h-3 mr-1" />Measure{s.unit ? ` (${s.unit})` : ""}</span>}
                        {s.requires_photo && <span className="k-pill k-pill-not_started"><Camera className="inline w-3 h-3 mr-1" />Photo</span>}
                      </div>
                      <div className="text-[11px] uppercase tracking-wide text-slate-400 mt-1">Source: {s.source}</div>
                    </div>
                    {role === "manager" && (
                      <div className="flex gap-1.5 shrink-0">
                        <button onClick={() => setEditId(s.id)} data-testid={`edit-step-${s.id}`} className="k-btn !px-2 !py-2"><Edit3 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => reject(s.id)} data-testid={`delete-step-${s.id}`} className="k-btn k-btn-danger !px-2 !py-2"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    )}
                  </li>
                )
              ))}
            </ul>
          </div>

          {suggested.length > 0 && (
            <div>
              <h4 className="font-display font-bold text-sm text-blue-600 mb-2">Pending AI Suggestions</h4>
              <ul className="space-y-1.5">
                {suggested.map((s) => (
                  <li key={s.id} className="k-surface p-3 flex items-start gap-3 border-l-2 border-blue-500" data-testid={`pending-step-${s.id}`}>
                    <Sparkles className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="text-sm text-slate-800">{s.description}</div>
                      {s.requires_photo && <div className="text-[11px] uppercase tracking-wide text-blue-600 font-semibold mt-0.5"><Camera className="inline w-3 h-3 mr-1" />Photo required</div>}
                    </div>
                    {role === "manager" && (
                      <div className="flex gap-1.5">
                        <button data-testid={`approve-step-${s.id}`} onClick={() => approve(s.id)} className="k-btn k-btn-primary !px-2 !py-2"><Check className="w-3.5 h-3.5" /></button>
                        <button data-testid={`reject-step-${s.id}`} onClick={() => reject(s.id)} className="k-btn !px-2 !py-2"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {role === "manager" && (
            <div className="border-t border-slate-200 pt-4">
              {adding ? (
                <RuleEditor onSave={addManual} onCancel={() => setAdding(false)} isNew />
              ) : (
                <button data-testid={`manual-add-${task.id}`} onClick={() => setAdding(true)} className="k-btn k-btn-primary"><Plus className="w-4 h-4" /> Add Validation Rule</button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RuleEditor({ initial, onSave, onCancel, isNew }) {
  const [d, setD] = React.useState({
    description: initial?.description || "",
    tolerance: initial?.tolerance || "",
    spec_reference: initial?.spec_reference || "",
    requires_measurement: initial?.requires_measurement || false,
    unit: initial?.unit || "",
    requires_photo: initial?.requires_photo || false,
  });
  const set = (patch) => setD((prev) => ({ ...prev, ...patch }));

  return (
    <div className="k-surface p-3 border-blue-300 space-y-2">
      <div>
        <label className="text-[11px] uppercase tracking-wide text-slate-500 block mb-1 font-semibold">Description *</label>
        <input data-testid="rule-desc" className="k-input !py-2" placeholder="e.g. Wall plumb vertical" value={d.description} onChange={(e) => set({ description: e.target.value })} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div>
          <label className="text-[11px] uppercase tracking-wide text-slate-500 block mb-1 font-semibold">Target / Tolerance</label>
          <input data-testid="rule-tolerance" className="k-input !py-2" placeholder='e.g. Plumb ± 1/4 in · 16 in O.C.' value={d.tolerance} onChange={(e) => set({ tolerance: e.target.value })} />
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wide text-slate-500 block mb-1 font-semibold">Plan / Spec Reference</label>
          <input data-testid="rule-spec" className="k-input !py-2" placeholder="e.g. S-201 / ACI 318" value={d.spec_reference} onChange={(e) => set({ spec_reference: e.target.value })} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4 pt-1">
        <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
          <input type="checkbox" data-testid="rule-measure" className="w-4 h-4 accent-blue-600" checked={d.requires_measurement} onChange={(e) => set({ requires_measurement: e.target.checked })} />
          Requires measured value
        </label>
        {d.requires_measurement && (
          <input data-testid="rule-unit" className="k-input !py-1.5 !text-sm max-w-[130px]" placeholder="unit (e.g. in)" value={d.unit} onChange={(e) => set({ unit: e.target.value })} />
        )}
        <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
          <input type="checkbox" data-testid="rule-photo" className="w-4 h-4 accent-blue-600" checked={d.requires_photo} onChange={(e) => set({ requires_photo: e.target.checked })} />
          Requires photo proof
        </label>
      </div>
      <div className="flex gap-2 pt-1">
        <button data-testid="rule-save" onClick={() => onSave(d)} disabled={!d.description.trim()} className="k-btn k-btn-primary !py-2"><Save className="w-3.5 h-3.5" /> {isNew ? "Add Rule" : "Save"}</button>
        <button onClick={onCancel} className="k-btn !py-2"><X className="w-3.5 h-3.5" /> Cancel</button>
      </div>
    </div>
  );
}
