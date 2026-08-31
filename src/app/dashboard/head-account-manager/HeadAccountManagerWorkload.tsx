"use client";
import { useTranslator } from "@/components/i18n/LocaleProvider";

type HeadAccountManagerWorkloadProps = {
  accountManagers: any[];
  kpis: any;
  filterAM: string;
  setFilterAM: (value: string) => void;
};

export default function HeadAccountManagerWorkload({
  accountManagers,
  kpis,
  filterAM,
  setFilterAM,
}: HeadAccountManagerWorkloadProps) {
  const t = useTranslator();
  return (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      <h2 className="text-lg font-bold text-slate-800 mb-4">Account Managers Workload</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <button
          onClick={() => setFilterAM("unassigned")}
          className={`p-4 rounded-xl border text-start transition ${filterAM === "unassigned" ? "bg-purple-50 border-purple-500 ring-1 ring-purple-500" : "bg-slate-50 hover:border-slate-300"}`}
        >
          <p className="text-sm font-bold text-slate-700">⚠️ Unassigned</p>
          <p className="text-2xl font-black text-purple-600 mt-2">{kpis.unassigned}</p>
          <p className="text-xs text-slate-400 mt-1">Needs delegation</p>
        </button>

        {accountManagers.map((am: any) => {
          const loadProjects = am.managedProjects || [];
          const load = loadProjects.length;
          const delayedCount = loadProjects.filter((p:any) => p.projectStatus === "delayed").length;
          const avgProg = load > 0 ? Math.round(loadProjects.reduce((acc:any, p:any) => acc + ((p.seoProgress + p.socialMediaProgress + p.mediaBuyerProgress) / 3), 0) / load) : 0;
          return (
            <button
              key={am.id}
              onClick={() => setFilterAM(filterAM === am.id ? "all" : am.id)}
              className={`p-4 rounded-xl border text-start transition ${filterAM === am.id ? "bg-indigo-50 border-indigo-500 ring-2 ring-indigo-500" : "bg-white hover:border-slate-300"}`}
            >
              <div className="flex justify-between items-center mb-2">
                <p className="text-sm font-bold text-slate-700 truncate" title={am.name}>{am.name.split(" ")[0]} {am.name.split(" ")[1]?.[0] || ""}.</p>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-1">
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">{t("status.active")}</p>
                  <p className={`text-xl font-black ${load > 15 ? "text-red-500" : load > 8 ? "text-amber-500" : "text-emerald-500"}`}>{load}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Avg Prg</p>
                  <p className="text-xl font-black text-slate-700">{avgProg}%</p>
                </div>
              </div>
              {delayedCount > 0 && <p className="text-[10px] text-red-600 font-bold mt-2 bg-red-100 rounded px-1.5 py-0.5 w-fit">{delayedCount} Delayed</p>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
