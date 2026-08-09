import React from "react";
import { LogOut, ChevronDown, Check } from "lucide-react";
import { apiClient } from "@/App";
import OfflineBanner from "@/components/OfflineBanner";

export default function Shell({ view, onChangeView, role, crewName, job, onLogout, onJobChange, children }) {
  const [jobs, setJobs] = React.useState([]);
  const [open, setOpen] = React.useState(false);

  const loadJobs = React.useCallback(async () => {
    const r = await apiClient.get("/jobs");
    setJobs(r.data);
  }, []);

  React.useEffect(() => { loadJobs(); }, [loadJobs]);

  const tabs = role === "manager"
    ? [
        { id: "dashboard", label: "Command" },
        { id: "tasks", label: "Tasks · AI Rules" },
        { id: "field", label: "Field View" },
        { id: "admin", label: "Admin" },
      ]
    : [
        { id: "field", label: "Field" },
        { id: "dashboard", label: "Dashboard" },
        { id: "tasks", label: "Tasks" },
      ];

  return (
    <div className="min-h-screen bg-[#09090B] text-[#FAFAFA]">
      <OfflineBanner />
      <header className="border-b border-[#3F3F46] bg-[#09090B]/95 backdrop-blur sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-baseline gap-3">
            <div className="font-display font-black text-2xl uppercase text-[#FF5F15]">PLUMBLINE</div>
            <div className="hidden md:block text-[10px] font-mono tracking-widest text-[#A1A1AA]">FIELD-OPS · v1</div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <div className="text-xs uppercase tracking-widest text-[#A1A1AA]">{role === "manager" ? "Manager" : "Crew"}</div>
              <div className="font-display font-bold uppercase text-sm">{crewName}</div>
            </div>
            <button data-testid="logout-btn" onClick={onLogout} className="k-btn p-3" title="Switch role">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Job banner — clickable for multi-job switch */}
        {job && (
          <div className="max-w-[1600px] mx-auto px-4 md:px-6 pb-3 flex items-center gap-4 flex-wrap relative">
            <button
              data-testid="job-switcher"
              onClick={() => { loadJobs(); setOpen(!open); }}
              className="flex items-center gap-3 hover:opacity-80 transition"
            >
              <span className="w-2 h-2 bg-[#CCFF00] rounded-full k-pulse" />
              <div className="font-display font-bold uppercase text-base md:text-lg text-left">{job.name}</div>
              {jobs.length > 1 && <ChevronDown className={`w-4 h-4 text-[#A1A1AA] transition-transform ${open ? "rotate-180" : ""}`} />}
            </button>
            <div className="text-xs font-mono text-[#A1A1AA]">{job.location} · {job.client}</div>

            {/* Job switcher dropdown */}
            {open && (
              <div data-testid="job-switcher-dropdown" className="absolute left-4 md:left-6 top-full mt-1 z-40 k-surface min-w-[300px] shadow-2xl">
                {jobs.map((j) => (
                  <button
                    key={j.id}
                    data-testid={`job-option-${j.id}`}
                    onClick={() => { onJobChange?.(j); setOpen(false); }}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#27272A] text-left border-b border-[#27272A] last:border-0"
                  >
                    <div className="min-w-0">
                      <div className="font-display font-bold uppercase text-sm truncate">{j.name}</div>
                      <div className="text-[10px] font-mono text-[#A1A1AA] mt-0.5">{j.location} · {j.client} · {j.status}</div>
                    </div>
                    {j.id === job.id && <Check className="w-4 h-4 text-[#CCFF00] flex-shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="max-w-[1600px] mx-auto px-2 md:px-4 flex overflow-x-auto">
          {tabs.map((t) => (
            <div
              key={t.id}
              data-testid={`tab-${t.id}`}
              onClick={() => onChangeView(t.id)}
              className={`k-tab ${view === t.id ? "active" : ""}`}
            >
              {t.label}
            </div>
          ))}
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 md:px-6 py-6 md:py-8" onClick={() => open && setOpen(false)}>{children}</main>
    </div>
  );
}
