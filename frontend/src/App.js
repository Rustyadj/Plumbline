import { useEffect, useState } from "react";
import "@/App.css";
import axios from "axios";
import Shell from "@/components/Shell";
import FieldView from "@/components/FieldView";
import Dashboard from "@/components/Dashboard";
import TasksAdmin from "@/components/TasksAdmin";
import SuperAdmin from "@/components/SuperAdmin";
import Onboarding from "@/components/Onboarding";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;
export const apiClient = axios.create({ baseURL: API });

function App() {
  const [role, setRole] = useState(localStorage.getItem("kreteops_role") || "");
  const [crewName, setCrewName] = useState(localStorage.getItem("kreteops_name") || "");
  const [view, setView] = useState(role === "manager" ? "dashboard" : "field");
  const [adminSection, setAdminSection] = useState("jobs");
  const [query, setQuery] = useState("");
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        let r = await apiClient.get("/jobs");
        if (r.data.length === 0) {
          await apiClient.post("/seed");
          r = await apiClient.get("/jobs");
        }
        const savedId = localStorage.getItem("plumbline_job_id");
        const found = savedId ? r.data.find((j) => j.id === savedId) : null;
        setJob(found || r.data[0]);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    };
    init();
  }, []);

  const changeJob = (j) => {
    setJob(j);
    localStorage.setItem("plumbline_job_id", j.id);
  };

  const navigate = (v, section) => {
    setView(v);
    if (section) setAdminSection(section);
    setQuery("");
  };

  const selectJobById = async (id) => {
    try {
      const r = await apiClient.get("/jobs");
      const found = r.data.find((j) => j.id === id);
      if (found) changeJob(found);
    } catch (e) { /* ignore */ }
  };

  const handleOnboarded = (r, n) => {
    setRole(r);
    setCrewName(n);
    localStorage.setItem("kreteops_role", r);
    localStorage.setItem("kreteops_name", n);
    setView(r === "manager" ? "dashboard" : "field");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] text-slate-900">
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 bg-blue-600 rounded-full k-pulse" />
          <div className="text-lg font-display font-bold tracking-tight">Loading PLUMBLINE…</div>
        </div>
      </div>
    );
  }

  if (!role || !crewName) {
    return <Onboarding onDone={handleOnboarded} />;
  }

  const reloadJob = async () => {
    const r = await apiClient.get("/jobs");
    if (r.data.length === 0) {
      await apiClient.post("/seed");
      const r2 = await apiClient.get("/jobs");
      setJob(r2.data[0]);
    } else {
      const stillThere = job && r.data.find((j) => j.id === job.id);
      setJob(stillThere || r.data[0]);
    }
  };

  return (
    <Shell
      view={view}
      adminSection={adminSection}
      onNavigate={navigate}
      role={role}
      crewName={crewName}
      job={job}
      onJobChange={changeJob}
      query={query}
      onQuery={setQuery}
      onLogout={() => {
        localStorage.clear();
        setRole("");
        setCrewName("");
      }}
    >
      {view === "field" && <FieldView job={job} crewName={crewName} role={role} query={query} />}
      {view === "dashboard" && <Dashboard job={job} />}
      {view === "tasks" && <TasksAdmin job={job} role={role} query={query} />}
      {view === "admin" && role === "manager" && (
        <SuperAdmin
          job={job}
          section={adminSection}
          onSection={setAdminSection}
          onJobChanged={reloadJob}
          onJobImported={selectJobById}
        />
      )}
    </Shell>
  );
}

export default App;
