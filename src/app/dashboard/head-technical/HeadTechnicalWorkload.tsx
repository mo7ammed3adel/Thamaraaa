"use client";
import { useTranslator } from "@/components/i18n/LocaleProvider";

type HeadTechnicalWorkloadProps = {
  teamLeaders: any[];
};

export default function HeadTechnicalWorkload({ teamLeaders }: HeadTechnicalWorkloadProps) {
  const t = useTranslator();
  return (
    <div className="bg-white rounded-xl shadow border p-5">
      <h2 className="text-lg font-bold text-slate-800 mb-4">{t("ht.leadersWorkload")}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {teamLeaders.map((leader: any) => (
          <div key={leader.id} className="border rounded-lg p-4 bg-slate-50">
            <p className="text-sm font-bold text-slate-800 truncate" title={leader.name}>{leader.name}</p>
            <p className="text-xs text-slate-500 capitalize mt-0.5">{leader.role.replace(/_/g, " ")}</p>
            <div className="mt-3 flex items-end justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-400">{t("ht.activeAssignments")}</span>
              <span className="text-2xl font-black text-indigo-700">{leader._count?.teamAssignments || 0}</span>
            </div>
          </div>
        ))}
        {teamLeaders.length === 0 && (
          <p className="text-sm text-slate-400 italic">{t("ht.noLeaders")}</p>
        )}
      </div>
    </div>
  );
}
