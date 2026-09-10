import React from "react";
import {
  LayoutDashboard, ClipboardList, HardHat, ShieldCheck, Briefcase, Settings,
  AlertTriangle, RotateCcw, ChevronDown, Check, Search, Plus, LogOut,
  PanelLeftClose, PanelLeftOpen, MessageSquare, Bot,
} from "lucide-react";
import { apiClient } from "@/App";
import OfflineBanner from "@/components/OfflineBanner";

export default function Shell({ view, adminSection, onNavigate, role, crewName, job, onLogout, onJobChange, query, onQuery, children }) {
  const [jobs, setJobs] = React.useState([]);
  const [jobOpen, setJobOpen] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(localStorage.getItem("plumbline_sidebar_collapsed") === "1");
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const loadJobs = React.useCallback(async () => {
    const r = await apiClient.get("/jobs");
    setJobs(r.data);
  }, []);
  React.useEffect(() => { loadJobs(); }, [loadJobs]);

  React.useEffect(() => {
    const close = (e) => { if (e.key === "Escape") { setMobileOpen(false); setJobOpen(false); } };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("plumbline_sidebar_collapsed", next ? "1" : "0");
  };

  const groups = role === "manager"
    ? [
        { title: "Overview", items: [
          { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, view: "dashboard" },
          { id: "feed", label: "Live Feed", icon: MessageSquare, view: "feed" },
        ]},
        { title: "Field", items: [
          { id: "field", label: "Field View", icon: HardHat, view: "field" },
          { id: "tasks", label: "Validation Rules", icon: ShieldCheck, view: "tasks" },
        ]},
        { title: "Admin", items: [
          { id: "a-jobs", label: "Jobs", icon: Briefcase, view: "admin", section: "jobs" },
          { id: "a-tasks", label: "Tasks", icon: ClipboardList, view: "admin", section: "tasks" },
          { id: "a-settings", label: "ROI Settings", icon: Settings, view: "admin", section: "settings" },
          { id: "a-ai", label: "AI Settings", icon: Bot, view: "admin", section: "ai" },
          { id: "a-mistakes", label: "Common Mistakes", icon: AlertTriangle, view: "admin", section: "mistakes" },
          { id: "a-danger", label: "Danger Zone", icon: RotateCcw, view: "admin", section: "danger" },
        ]},
      ]
    : [
        { title: "Overview", items: [
          { id: "feed", label: "Live Feed", icon: MessageSquare, view: "feed" },
          { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, view: "dashboard" },
        ]},
        { title: "Field", items: [
          { id: "field", label: "Field View", icon: HardHat, view: "field" },
          { id: "tasks", label: "Validation Rules", icon: ShieldCheck, view: "tasks" },
        ]},
      ];

  const isActive = (it) => it.view === view && (it.view !== "admin" || it.section === adminSection);

  const searchable = view === "field" || view === "tasks";

  const go = (it) => {
    onNavigate(it.view, it.section);
    setMobileOpen(false);
  };

  const initials = (crewName || "?").split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  const Sidebar = (
    <aside
      className={`${collapsed ? "w-16" : "w-[216px]"} ledger-sidebar flex flex-col shrink-0 transition-[width] duration-300 h-full`}
      data-testid="sidebar"
    >
      <div className={`h-16 flex items-center ${collapsed ? "justify-center" : "px-5"} border-b border-slate-800 shrink-0`}>
        <div className="w-8 h-8 rounded-lg ledger-brand-icon flex items-center justify-center shrink-0">
          <ShieldCheck className="w-[18px] h-[18px] text-current" strokeWidth={1.5} />
        </div>
        {!collapsed && (
          <div className="ml-3 leading-none">
            <div className="font-display font-extrabold text-[17px] tracking-tight">PLUMBLINE</div>
            <div className="text-[10px] text-slate-500 font-mono mt-0.5">ZERO REWORK</div>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        {groups.map((g) => (
          <div key={g.title}>
            {!collapsed && <div className="k-nav-group">{g.title}</div>}
            {collapsed && <div className="mx-3 my-2 border-t border-slate-800" />}
            {g.items.map((it) => {
              const Icon = it.icon;
              return (
                <div
                  key={it.id}
                  data-testid={`nav-${it.id}`}
                  aria-current={isActive(it) ? "page" : undefined}
                  role="button"
                  tabIndex={0}
                  onClick={() => go(it)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(it); } }}
                  title={collapsed ? it.label : undefined}
                  className={`k-nav ${isActive(it) ? "active" : ""} ${collapsed ? "!justify-center !mx-2" : ""}`}
                >
                  <Icon className="w-[18px] h-[18px] shrink-0" strokeWidth={2} />
                  {!collapsed && <span className="truncate">{it.label}</span>}
                </div>
              );
            })}
          </div>
        ))}
      </nav>

      <button
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        data-testid="sidebar-collapse"
        onClick={toggleCollapse}
        className={`hidden md:flex items-center gap-2 text-slate-400 hover:text-white text-sm px-5 h-12 border-t border-slate-800 shrink-0 ${collapsed ? "justify-center px-0" : ""}`}
      >
        {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <><PanelLeftClose className="w-4 h-4" /> <span>Collapse</span></>}
      </button>
    </aside>
  );

  return (
    <div className="ledger-shell flex h-screen overflow-hidden">
      <a className="ledger-skip" href="#main-content">Skip to content</a>
      {/* Desktop sidebar */}
      <div className="hidden md:flex h-full">{Sidebar}</div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="h-full">{Sidebar}</div>
          <div className="flex-1 bg-black/40" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 h-full">
        {/* Top bar */}
        <header className="ledger-topbar h-16 border-b border-slate-200 flex items-center gap-3 px-4 md:px-6 shrink-0 z-20">
          <button aria-label="Open navigation" data-testid="mobile-menu-btn" onClick={() => setMobileOpen(true)} className="md:hidden k-btn !px-2.5 !py-2">
            <PanelLeftOpen className="w-4 h-4" />
          </button>

          {/* Job switcher */}
          <div className="relative">
            <button
              aria-expanded={jobOpen} data-testid="job-switcher"
              onClick={() => { loadJobs(); setJobOpen(!jobOpen); }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors max-w-[28vw] sm:max-w-[46vw] md:max-w-none"
            >
              <span className="w-2 h-2 bg-emerald-500 rounded-full k-pulse shrink-0" />
              <span className="font-display font-bold text-sm truncate">{job?.name || "No job"}</span>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${jobOpen ? "rotate-180" : ""}`} />
            </button>
            {jobOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setJobOpen(false)} />
                <div data-testid="job-switcher-dropdown" className="absolute left-0 top-full mt-1 z-40 bg-white border border-slate-200 rounded-lg shadow-lg min-w-[300px] py-1 k-fade-in">
                  {jobs.map((j) => (
                    <button
                      key={j.id}
                      data-testid={`job-option-${j.id}`}
                      onClick={() => { onJobChange?.(j); setJobOpen(false); }}
                      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 text-left"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-sm truncate text-slate-900">{j.name}</div>
                        <div className="text-xs text-slate-500 mt-0.5 truncate">{j.location || "—"} · {j.client || "—"}</div>
                      </div>
                      {j.id === job?.id && <Check className="w-4 h-4 text-blue-600 shrink-0 ml-2" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Search */}
          {searchable && <div className="flex-1 max-w-xl hidden sm:block">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                aria-label="Search tasks" data-testid="topbar-search"
                value={query}
                onChange={(e) => onQuery(e.target.value)}
                placeholder={searchable ? "Search tasks…" : "Search…"}
                disabled={!searchable}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15 transition disabled:opacity-60"
              />
            </div>
          </div>

          }
          <div className={searchable ? "flex-1 sm:hidden" : "flex-1"} />

          {role === "manager" && (
            <button
              aria-label="New Job" data-testid="topbar-new-btn"
              onClick={() => onNavigate("admin", "jobs")}
              className="k-btn k-btn-primary !py-2"
            >
              <Plus className="w-4 h-4" /> <span className="hidden sm:inline">New Job</span>
            </button>
          )}

          <div className="flex items-center gap-2 pl-1">
            <div className="text-right hidden md:block leading-tight">
              <div className="text-sm font-semibold text-slate-900">{crewName}</div>
              <div className="text-[11px] text-slate-500">{role === "manager" ? "Manager" : "Field Crew"}</div>
            </div>
            <div className="w-9 h-9 rounded-full bg-[#34382f] text-white flex items-center justify-center text-xs font-bold shrink-0">
              {initials}
            </div>
            <button aria-label="Switch role" data-testid="logout-btn" onClick={onLogout} title="Switch role" className="k-btn !px-2.5 !py-2 !shadow-none">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        <OfflineBanner />
        {searchable && <div className="sm:hidden px-4 py-2 border-b border-slate-200"><input aria-label="Search tasks" className="k-input" placeholder="Search tasks…" value={query} onChange={(e) => onQuery(e.target.value)} /></div>}

        <main className="flex-1 overflow-auto" id="main-content" tabIndex={-1}>
          <div className="ledger-content p-4 md:p-8 max-w-[1700px] mx-auto w-full">{children}</div>
        </main>
      </div>
    </div>
  );
}
