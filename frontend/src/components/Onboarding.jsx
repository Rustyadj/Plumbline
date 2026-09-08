import React from "react";
import { HardHat, Eye, ShieldCheck, ArrowRight } from "lucide-react";

export default function Onboarding({ onDone }) {
  const [role, setRole] = React.useState("");
  const [name, setName] = React.useState("");

  const go = () => {
    if (!name.trim() || !role) return;
    onDone(role, name.trim());
  };

  return (
    <div className="min-h-screen bg-[#f7f6f2] flex items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full">
        <div className="k-surface p-8 md:p-10">
          {/* Brand */}
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <div className="font-display font-extrabold text-2xl tracking-tight text-slate-900">PLUMBLINE</div>
              <div className="text-xs text-slate-500 font-mono">Field-Ops · v1.0</div>
            </div>
          </div>
          <p className="text-slate-600 text-sm leading-relaxed mb-8">
            Build to the plumbline. <span className="font-semibold text-slate-900">Zero rework.</span> Crews validate as they go,
            managers see live truth.
          </p>

          {/* Name */}
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 block mb-2">Your Name</label>
          <input
            data-testid="onboard-name-input"
            className="k-input mb-6"
            placeholder="e.g. Ryan Cantrell"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && go()}
          />

          {/* Role */}
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 block mb-2">Choose Your Role</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
            <button
              data-testid="role-crew-btn"
              onClick={() => setRole("crew")}
              className={`text-left p-4 rounded-xl border-2 transition-all ${role === "crew" ? "border-blue-600 bg-blue-50" : "border-slate-200 hover:border-slate-300 bg-white"}`}
            >
              <HardHat className={`w-6 h-6 mb-2 ${role === "crew" ? "text-blue-600" : "text-slate-400"}`} />
              <div className="font-display font-bold text-slate-900">Field Crew</div>
              <div className="text-xs text-slate-500 mt-0.5">Log production. Walk validations.</div>
            </button>
            <button
              data-testid="role-manager-btn"
              onClick={() => setRole("manager")}
              className={`text-left p-4 rounded-xl border-2 transition-all ${role === "manager" ? "border-blue-600 bg-blue-50" : "border-slate-200 hover:border-slate-300 bg-white"}`}
            >
              <Eye className={`w-6 h-6 mb-2 ${role === "manager" ? "text-blue-600" : "text-slate-400"}`} />
              <div className="font-display font-bold text-slate-900">Manager</div>
              <div className="text-xs text-slate-500 mt-0.5">Approve rules. Watch ratios.</div>
            </button>
          </div>

          <button
            data-testid="onboard-continue-btn"
            onClick={go}
            disabled={!name.trim() || !role}
            className="k-btn k-btn-primary k-btn-lg w-full"
          >
            Enter Jobsite <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
