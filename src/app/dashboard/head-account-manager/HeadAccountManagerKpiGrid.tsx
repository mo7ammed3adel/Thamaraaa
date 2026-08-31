"use client";

type HeadAccountManagerKpiGridProps = {
  kpis: any;
  activeKpi: string;
  setActiveKpi: (value: string) => void;
};

export default function HeadAccountManagerKpiGrid({ kpis, activeKpi, setActiveKpi }: HeadAccountManagerKpiGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
      {[
        { id: "all", label: "Total Projects", val: kpis.total, colors: "border-transparent bg-white hover:bg-gray-50", activeColors: "border-slate-500 bg-slate-50" },
        { id: "newToday", label: "New Today", val: kpis.newToday, colors: "border-transparent bg-white hover:bg-gray-50", activeColors: "border-blue-500 bg-blue-50" },
        { id: "active", label: "Active", val: kpis.active, colors: "border-transparent bg-white hover:bg-gray-50", activeColors: "border-indigo-500 bg-indigo-50" },
        { id: "unassigned", label: "Unassigned", val: kpis.unassigned, colors: "border-transparent bg-white hover:bg-gray-50", activeColors: "border-purple-500 bg-purple-50" },
        { id: "delayed", label: "Delayed", val: kpis.delayed, colors: "border-transparent bg-white hover:bg-gray-50", activeColors: "border-red-500 bg-red-50" },
        { id: "completed", label: "Completed", val: kpis.completed, colors: "border-transparent bg-white hover:bg-gray-50", activeColors: "border-emerald-500 bg-emerald-50" },
        { id: "warnings", label: "Warnings", val: kpis.warnings, colors: "border-transparent bg-white hover:bg-gray-50", activeColors: "border-orange-500 bg-orange-50" },
        { id: "avg", label: "Avg Progress", val: `${kpis.avgCompletion}%`, colors: "border-transparent bg-white hover:bg-gray-50", activeColors: "border-teal-500 bg-teal-50", disableFilter: true },
      ].map(k => (
        <button
          key={k.label}
          onClick={() => !k.disableFilter && setActiveKpi(activeKpi === k.id ? "all" : k.id)}
          disabled={k.disableFilter}
          className={`p-4 rounded-xl border-2 text-start transition ${k.disableFilter ? "cursor-default shadow-sm" : "cursor-pointer"} ${activeKpi === k.id ? k.activeColors : `${k.colors} ${k.disableFilter ? "" : "shadow-sm"}`}`}
        >
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{k.label}</p>
          <p className="text-2xl font-black mt-1 text-slate-900">{k.val}</p>
        </button>
      ))}
    </div>
  );
}
