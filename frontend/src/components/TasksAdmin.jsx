import React from "react";
import { apiClient } from "@/App";
import { Sparkles, Check, X, Plus, Trash2, Camera, ChevronDown } from "lucide-react";

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

      <div className="space-y-2">
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
  const [newDesc, setNewDesc] = React.useState("");
  const [newPhoto, setNewPhoto] = React.useState(false);

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
  const addManual = async () => {
    if (!newDesc.trim()) return;
    await apiClient.post(`/tasks/${task.id}/validation-steps`, { description: newDesc.trim(), requires_photo: newPhoto, source: "manual", approved: true });
    setNewDesc(""); setNewPhoto(false); load();
  };

  const approved = steps.filter(s => s.approved);
  const suggested = steps.filter(s => !s.approved);

  return (
    <div className="k-surface overflow-hidden">
      <button data-testid={`admin-row-${task.id}`} onClick={onToggle} className="w-full text-left p-4 hover:bg-slate-50 flex items-center gap-3 transition-colors">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[11px] text-blue-600 uppercase tracking-wide font-semibold">{task.category}</span>
            {task.course !== "all" && <span className="text-[11px] text-slate-400 uppercase tracking-wide font-medium">{task.course} course</span>}
            <span className="k-pill k-pill-validated">{approved.length || "—"} rules</span>
          </div>
          <div className="font-display font-bold text-slate-900 truncate">{task.name}</div>
        </div>
        <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="border-t border-slate-200 p-4 space-y-4 bg-[#F8FAFC] k-slide-up">
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
                <li key={s.id} className="k-surface p-3 flex items-start gap-3" data-testid={`approved-step-${s.id}`}>
                  <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="text-sm text-slate-800">{s.description}</div>
                    {s.requires_photo && <div className="text-[11px] uppercase tracking-wide text-blue-600 font-semibold mt-0.5"><Camera className="inline w-3 h-3 mr-1" />Photo required</div>}
                    <div className="text-[11px] uppercase tracking-wide text-slate-400 mt-0.5">Source: {s.source}</div>
                  </div>
                  {role === "manager" && <button onClick={() => reject(s.id)} data-testid={`delete-step-${s.id}`} className="k-btn !px-2 !py-2"><Trash2 className="w-3.5 h-3.5" /></button>}
                </li>
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
              <h4 className="font-display font-bold text-sm text-slate-500 mb-2">Add Manual Rule</h4>
              <input data-testid={`manual-desc-${task.id}`} className="k-input" placeholder="e.g. Verify rebar lap is at least 30 inches" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
              <label className="flex items-center gap-2 mt-2 cursor-pointer text-sm text-slate-700">
                <input type="checkbox" data-testid={`manual-photo-${task.id}`} checked={newPhoto} onChange={(e) => setNewPhoto(e.target.checked)} />
                Requires photo proof
              </label>
              <button data-testid={`manual-add-${task.id}`} onClick={addManual} className="k-btn k-btn-primary mt-2"><Plus className="w-4 h-4" /> Add Rule</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
