import React from "react";
import { apiClient } from "@/App";
import { Camera, Check, X, ChevronRight, Search, AlertTriangle, Sparkles, WifiOff } from "lucide-react";
import { isOnline, cacheTasks, getCachedTasks, cacheSteps, getCachedSteps, enqueueEntry } from "@/lib/offline";

const STATUS_LABEL = {
  not_started: "Not Started",
  in_progress: "In Progress",
  validated: "Validated",
  rework: "Rework",
};

const CATEGORIES = ["All", "Precon", "Startup", "Layout", "Install", "Rebar", "Pour", "Strip", "Cleanup"];

export default function FieldView({ job, crewName, role }) {
  const [tasks, setTasks] = React.useState([]);
  const [filter, setFilter] = React.useState("All");
  const [search, setSearch] = React.useState("");
  const [courseFilter, setCourseFilter] = React.useState("All");
  const [openTask, setOpenTask] = React.useState(null);

  const load = React.useCallback(async () => {
    if (!job) return;
    if (isOnline()) {
      try {
        const r = await apiClient.get(`/jobs/${job.id}/tasks`);
        setTasks(r.data);
        cacheTasks(job.id, r.data);
        return;
      } catch (e) {
        // fall through to cache
      }
    }
    const cached = getCachedTasks(job.id);
    if (cached?.tasks) setTasks(cached.tasks);
  }, [job]);

  React.useEffect(() => { load(); }, [load]);

  const filtered = tasks.filter((t) => {
    if (filter !== "All" && t.category !== filter) return false;
    if (courseFilter !== "All" && t.course !== courseFilter) return false;
    if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const counts = {
    rework: tasks.filter(t => t.status === "rework").length,
    in_progress: tasks.filter(t => t.status === "in_progress").length,
    validated: tasks.filter(t => t.status === "validated").length,
  };

  return (
    <div data-testid="field-view">
      {/* Hero stats */}
      <div className="grid grid-cols-3 gap-2 md:gap-4 mb-6">
        <StatChip label="Rework" value={counts.rework} tone="rework" testid="stat-rework" />
        <StatChip label="In Progress" value={counts.in_progress} tone="in_progress" testid="stat-in-progress" />
        <StatChip label="Validated" value={counts.validated} tone="validated" testid="stat-validated" />
      </div>

      {/* Filters */}
      <div className="k-surface p-3 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Search className="w-4 h-4 text-[#A1A1AA] ml-2" />
          <input
            data-testid="task-search-input"
            className="k-input border-0 bg-transparent !p-2"
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              data-testid={`filter-category-${c}`}
              onClick={() => setFilter(c)}
              className={`k-btn whitespace-nowrap py-2 px-3 text-xs ${filter === c ? "!bg-[#FF5F15] !text-[#09090B] !border-[#FF5F15]" : ""}`}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="flex gap-2 mt-2 overflow-x-auto">
          {["All", "all", "1st", "2nd", "3rd", "4th", "5th"].map((c) => (
            <button
              key={c}
              data-testid={`filter-course-${c}`}
              onClick={() => setCourseFilter(c)}
              className={`k-btn whitespace-nowrap py-1.5 px-3 text-[10px] ${courseFilter === c ? "!bg-[#CCFF00] !text-[#09090B] !border-[#CCFF00]" : ""}`}
            >
              {c === "all" ? "Common" : c === "All" ? "All Levels" : `${c} Course`}
            </button>
          ))}
        </div>
      </div>

      {/* Task list */}
      <div data-testid="task-list" className="space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-[#A1A1AA]">No tasks match these filters.</div>
        )}
        {filtered.map((t) => (
          <TaskRow key={t.id} task={t} onOpen={() => setOpenTask(t)} />
        ))}
      </div>

      {openTask && (
        <TaskSheet
          task={openTask}
          crewName={crewName}
          role={role}
          onClose={() => setOpenTask(null)}
          onSaved={() => { load(); setOpenTask(null); }}
        />
      )}
    </div>
  );
}

function StatChip({ label, value, tone, testid }) {
  const color = {
    rework: "border-[#FF5F15] text-[#FF5F15]",
    in_progress: "border-[#3B82F6] text-[#3B82F6]",
    validated: "border-[#CCFF00] text-[#CCFF00]",
  }[tone];
  return (
    <div data-testid={testid} className={`k-surface ${color.split(" ")[0]} p-3 md:p-4`}>
      <div className="text-[10px] uppercase tracking-widest text-[#A1A1AA] font-semibold">{label}</div>
      <div className={`font-display font-black text-3xl md:text-5xl mt-1 ${color.split(" ")[1]}`}>{value}</div>
    </div>
  );
}

function TaskRow({ task, onOpen }) {
  const pct = task.estimated_qty
    ? Math.min(100, (task.actual_qty / task.estimated_qty) * 100)
    : task.estimated_hours
      ? Math.min(100, (task.actual_hours / task.estimated_hours) * 100)
      : 0;
  return (
    <button
      data-testid={`task-row-${task.id}`}
      onClick={onOpen}
      className="k-surface w-full p-4 text-left hover:border-zinc-600 transition-colors flex items-center gap-3 group"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <span className={`k-pill k-pill-${task.status}`}>{STATUS_LABEL[task.status]}</span>
          {task.course !== "all" && (
            <span className="text-[10px] font-mono text-[#A1A1AA] uppercase tracking-widest">{task.course} course</span>
          )}
          <span className="text-[10px] font-mono text-[#FF5F15] uppercase tracking-widest">{task.category}</span>
        </div>
        <div className="font-display font-bold text-base md:text-lg uppercase truncate">{task.name}</div>
        <div className="text-xs text-[#A1A1AA] mt-1 font-mono">
          {task.actual_hours.toFixed(1)} / {task.estimated_hours?.toFixed(1) || "—"} hrs
          {task.unit && <span className="ml-3">{task.actual_qty.toFixed(0)} / {task.estimated_qty?.toFixed(0) || "—"} {task.unit}</span>}
        </div>
        <div className="h-1.5 bg-[#27272A] mt-2 overflow-hidden">
          <div
            className="h-full"
            style={{
              width: `${pct}%`,
              background: task.status === "rework" ? "#FF5F15" : task.status === "validated" ? "#CCFF00" : "#3B82F6",
            }}
          />
        </div>
      </div>
      <ChevronRight className="w-6 h-6 text-[#A1A1AA] group-hover:text-[#FF5F15] flex-shrink-0" />
    </button>
  );
}

function TaskSheet({ task, crewName, role, onClose, onSaved }) {
  const [steps, setSteps] = React.useState([]);
  const [entries, setEntries] = React.useState([]);
  const [hours, setHours] = React.useState("");
  const [qty, setQty] = React.useState("");
  const [r, setR] = React.useState("Installer");
  const [notes, setNotes] = React.useState("");
  const [vstate, setVstate] = React.useState({}); // step_id -> {status, photo, fix_notes}
  const [saving, setSaving] = React.useState(false);
  const [fixLoading, setFixLoading] = React.useState({});

  React.useEffect(() => {
    (async () => {
      if (isOnline()) {
        try {
          const r1 = await apiClient.get(`/tasks/${task.id}/validation-steps`);
          setSteps(r1.data);
          cacheSteps(task.id, r1.data);
          const r2 = await apiClient.get(`/tasks/${task.id}/entries`);
          setEntries(r2.data);
          return;
        } catch (e) {
          // fall through to cache
        }
      }
      const cached = getCachedSteps(task.id);
      if (cached?.steps) setSteps(cached.steps);
      // entries won't be cached offline; leave empty
    })();
  }, [task.id]);

  const setStep = (id, patch) => setVstate((s) => ({ ...s, [id]: { ...(s[id] || {}), ...patch } }));

  const onPhoto = (id, file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setStep(id, { photo_b64: reader.result });
    reader.readAsDataURL(file);
  };

  const askAIFix = async (step) => {
    setFixLoading((s) => ({ ...s, [step.id]: true }));
    try {
      const r = await apiClient.post("/validation/fix-suggestion", {
        task_name: task.name,
        task_category: task.category,
        failed_check: step.description,
        notes: vstate[step.id]?.fix_notes || "",
      });
      setStep(step.id, { fix_notes: r.data.fix });
    } catch (e) {
      alert("AI fix failed. Check connection.");
    }
    setFixLoading((s) => ({ ...s, [step.id]: false }));
  };

  const approvedSteps = steps.filter((s) => s.approved);

  const allRequiredOK = approvedSteps.every((s) => {
    const v = vstate[s.id];
    if (!v || !v.status) return false;
    if (v.status === "pass" && s.requires_photo && !v.photo_b64) return false;
    return true;
  });

  const submit = async () => {
    if (!hours && !qty) { alert("Enter hours or quantity completed."); return; }
    setSaving(true);
    try {
      const validations = approvedSteps.map((s) => {
        const v = vstate[s.id] || {};
        return {
          step_id: s.id,
          description: s.description,
          status: v.status || "skipped",
          photo_b64: v.photo_b64 || null,
          fix_notes: v.fix_notes || null,
          timestamp: new Date().toISOString(),
        };
      });
      const payload = {
        crew_member: crewName,
        role: r,
        hours: parseFloat(hours) || 0,
        qty_completed: parseFloat(qty) || 0,
        notes,
        validations,
      };
      if (isOnline()) {
        await apiClient.post(`/tasks/${task.id}/entries`, payload);
      } else {
        enqueueEntry(task.id, payload);
        window.dispatchEvent(new Event("plumbline:queue-updated"));
      }
      onSaved();
    } catch (e) {
      // Network error mid-submit → queue instead of losing data
      const payload = {
        crew_member: crewName,
        role: r,
        hours: parseFloat(hours) || 0,
        qty_completed: parseFloat(qty) || 0,
        notes,
        validations: approvedSteps.map((s) => {
          const v = vstate[s.id] || {};
          return {
            step_id: s.id, description: s.description, status: v.status || "skipped",
            photo_b64: v.photo_b64 || null, fix_notes: v.fix_notes || null,
            timestamp: new Date().toISOString(),
          };
        }),
      };
      enqueueEntry(task.id, payload);
      window.dispatchEvent(new Event("plumbline:queue-updated"));
      alert("No signal — entry queued locally. It'll sync when you're back online.");
      onSaved();
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex justify-center p-0 md:p-4">
      <div className="bg-[#09090B] border-2 border-[#3F3F46] w-full max-w-3xl flex flex-col h-full md:max-h-[92vh] md:h-auto k-slide-up">
        {/* Header */}
        <div className="border-b border-[#3F3F46] p-5 flex items-start justify-between gap-4 bg-[#09090B] flex-shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={`k-pill k-pill-${task.status}`}>{STATUS_LABEL[task.status]}</span>
              <span className="text-[10px] font-mono text-[#FF5F15] uppercase tracking-widest">{task.category}</span>
              {task.course !== "all" && (
                <span className="text-[10px] font-mono text-[#A1A1AA] uppercase tracking-widest">{task.course} course</span>
              )}
            </div>
            <h2 className="font-display font-black text-2xl md:text-3xl uppercase leading-tight">{task.name}</h2>
            <div className="text-xs text-[#A1A1AA] mt-1 font-mono">
              {task.actual_hours.toFixed(1)} / {task.estimated_hours?.toFixed(1) || "—"} est-hrs
              {task.unit && <span className="ml-3">{task.actual_qty.toFixed(0)} / {task.estimated_qty?.toFixed(0) || "—"} {task.unit}</span>}
            </div>
          </div>
          <button data-testid="close-task-sheet" onClick={onClose} className="k-btn p-3"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-6 overflow-y-auto flex-1 min-h-0">
          {/* Production entry */}
          <section>
            <h3 className="font-display font-bold uppercase tracking-tight text-lg mb-3 text-[#CCFF00]">1 · Log Production</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs uppercase tracking-widest text-[#A1A1AA] block mb-1.5">Hours Worked</label>
                <input
                  data-testid="entry-hours-input"
                  type="number"
                  step="0.25"
                  className="k-input"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest text-[#A1A1AA] block mb-1.5">
                  Completed {task.unit ? `(${task.unit})` : ""}
                </label>
                <input
                  data-testid="entry-qty-input"
                  type="number"
                  step="1"
                  className="k-input"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="mt-3">
              <label className="text-xs uppercase tracking-widest text-[#A1A1AA] block mb-1.5">Role</label>
              <select data-testid="entry-role-select" value={r} onChange={(e) => setR(e.target.value)} className="k-select">
                {["Foreman", "Installer", "Apprentice", "Laborer", "Forklift"].map((x) => <option key={x}>{x}</option>)}
              </select>
            </div>
          </section>

          {/* Validation checklist */}
          <section>
            <h3 className="font-display font-bold uppercase tracking-tight text-lg mb-3 text-[#CCFF00]">2 · Validation Layer</h3>
            <div className="space-y-3">
              {approvedSteps.length === 0 && (
                <div className="text-sm text-[#A1A1AA] p-4 border border-dashed border-[#3F3F46]">
                  No approved validation steps yet. Ask your manager to approve AI suggestions for this task.
                </div>
              )}
              {approvedSteps.map((s) => {
                const v = vstate[s.id] || {};
                return (
                  <div key={s.id} data-testid={`val-step-${s.id}`} className="k-surface p-4">
                    <div className="flex items-start gap-3">
                      <button
                        data-testid={`val-pass-${s.id}`}
                        className={`k-check ${v.status === "pass" ? "pass" : ""}`}
                        onClick={() => setStep(s.id, { status: v.status === "pass" ? null : "pass" })}
                        title="Mark Pass"
                      >
                        {v.status === "pass" && <Check className="w-5 h-5" />}
                      </button>
                      <button
                        data-testid={`val-fail-${s.id}`}
                        className={`k-check ${v.status === "fail" ? "fail" : ""}`}
                        onClick={() => setStep(s.id, { status: v.status === "fail" ? null : "fail" })}
                        title="Flag Fail"
                      >
                        {v.status === "fail" && <X className="w-5 h-5" />}
                      </button>
                      <div className="flex-1">
                        <div className="font-medium leading-snug">{s.description}</div>
                        {s.requires_photo && (
                          <div className="text-[10px] uppercase tracking-widest text-[#FF5F15] font-bold mt-1">PHOTO REQUIRED</div>
                        )}
                      </div>
                    </div>

                    {/* Photo capture */}
                    {v.status === "pass" && s.requires_photo && (
                      <label className="k-photo mt-3 block p-4" data-testid={`val-photo-label-${s.id}`}>
                        {v.photo_b64 ? (
                          <img src={v.photo_b64} alt="proof" className="max-h-48 mx-auto" />
                        ) : (
                          <div className="flex items-center gap-2 justify-center">
                            <Camera className="w-5 h-5" />
                            <span className="text-sm">Tap to capture proof</span>
                          </div>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          data-testid={`val-photo-input-${s.id}`}
                          onChange={(e) => onPhoto(s.id, e.target.files?.[0])}
                          className="hidden"
                        />
                      </label>
                    )}

                    {/* Failed -> AI fix */}
                    {v.status === "fail" && (
                      <div className="mt-3 border-l-2 border-[#FF5F15] pl-3">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle className="w-4 h-4 text-[#FF5F15]" />
                          <span className="text-xs uppercase tracking-widest text-[#FF5F15] font-bold">Flagged — Fix Required</span>
                        </div>
                        <textarea
                          data-testid={`val-fix-notes-${s.id}`}
                          className="k-textarea"
                          rows={2}
                          placeholder="What went wrong? (e.g. buck out of plumb by 3/8)"
                          value={v.fix_notes || ""}
                          onChange={(e) => setStep(s.id, { fix_notes: e.target.value })}
                        />
                        <button
                          data-testid={`val-ai-fix-${s.id}`}
                          onClick={() => askAIFix(s)}
                          disabled={fixLoading[s.id]}
                          className="k-btn mt-2 text-xs"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          {fixLoading[s.id] ? "Asking AI…" : "Get AI Fix-It Guidance"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Notes */}
          <section>
            <h3 className="font-display font-bold uppercase tracking-tight text-lg mb-3 text-[#CCFF00]">3 · Notes (optional)</h3>
            <textarea
              data-testid="entry-notes-input"
              className="k-textarea"
              rows={3}
              placeholder="Anything the next shift should know?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </section>

          {/* Submit */}
          <div className="pt-2">
            <div className="text-[10px] text-center text-[#A1A1AA] mt-2 uppercase tracking-widest">
              {allRequiredOK ? "All required checks complete" : "Some required checks not complete — entry will save as in-progress"}
            </div>
          </div>

          {/* Recent entries */}
          {entries.length > 0 && (
            <section>
              <h3 className="font-display font-bold uppercase tracking-tight text-lg mb-3 text-[#A1A1AA]">Recent Entries</h3>
              <div className="space-y-2">
                {entries.slice(0, 5).map((e) => (
                  <div key={e.id} className="k-surface-2 p-3 text-sm flex items-center justify-between">
                    <div>
                      <span className="font-semibold">{e.crew_member}</span>
                      <span className="text-[#A1A1AA] ml-2">{e.role}</span>
                      {e.has_failed_check && <span className="k-pill k-pill-rework ml-2">FLAG</span>}
                    </div>
                    <div className="font-mono text-xs text-[#A1A1AA]">
                      {e.hours.toFixed(1)}h · {e.qty_completed.toFixed(0)}{task.unit || ""}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Sticky footer with submit */}
        <div className="border-t border-[#3F3F46] p-4 bg-[#09090B] flex-shrink-0">
          <button
            data-testid="submit-entry-btn"
            onClick={submit}
            disabled={saving}
            className="k-btn k-btn-primary k-btn-lg w-full"
          >
            {saving ? "Saving…" : !isOnline() ? (<><WifiOff className="w-4 h-4" /> Queue Entry (Offline)</>) : allRequiredOK ? "Submit & Validate ✓" : "Submit (Partial)"}
          </button>
        </div>
      </div>
    </div>
  );
}
