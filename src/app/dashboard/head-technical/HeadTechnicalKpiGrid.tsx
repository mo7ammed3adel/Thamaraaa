"use client";

type HeadTechnicalKpiGridProps = {
  kpis: any;
  activeKpi: string;
  setActiveKpi: (value: string) => void;
};

export default function HeadTechnicalKpiGrid({ kpis, activeKpi, setActiveKpi }: HeadTechnicalKpiGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
      {[
        { id: "all", label: "My Total Projects", val: kpis.totalProjects, colors: "border-transparent bg-white hover:bg-gray-50", activeColors: "border-slate-500 bg-slate-50", icnColor: "text-slate-500" },
        { id: "unassigned", label: "Needs TL", val: kpis.unassignedTechnicalLeaders, colors: "border-transparent bg-white hover:bg-gray-50", activeColors: "border-purple-500 bg-purple-50", icnColor: "text-purple-500" },
        { id: "active", label: "Active Clients", val: kpis.activeClients, colors: "border-transparent bg-white hover:bg-gray-50", activeColors: "border-indigo-500 bg-indigo-50", icnColor: "text-indigo-500" },
        { id: "delayed", label: "Delayed Clients", val: kpis.delayedClients, colors: "border-transparent bg-white hover:bg-gray-50", activeColors: "border-red-500 bg-red-50", icnColor: "text-red-500" },
        { id: "warnings", label: "Warnings", val: kpis.warningsCount, colors: "border-transparent bg-white hover:bg-gray-50", activeColors: "border-orange-500 bg-orange-50", icnColor: "text-orange-500" },
        { id: "in_progress", label: "Tasks In Progress", val: kpis.tasksInProgress, colors: "border-transparent bg-white hover:bg-gray-50", activeColors: "border-amber-500 bg-amber-50", icnColor: "text-amber-500" }
      ].map(k => (
        <button
          key={k.label}
          onClick={() => setActiveKpi(activeKpi === k.id ? "all" : k.id)}
          className={`p-4 flex flex-col justify-between rounded-xl border-2 text-left transition cursor-pointer ${activeKpi === k.id ? k.activeColors : `${k.colors} shadow-sm`}`}
        >
          <div className={`flex items-center gap-2 mb-2 ${k.icnColor}`}>
            <span className="text-[11px] font-bold uppercase tracking-wider">{k.label}</span>
          </div>
          <p className="text-2xl font-black mt-1 text-slate-900">{k.val}</p>
        </button>
      ))}
    </div>
  );
}
