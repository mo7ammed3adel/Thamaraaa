"use client";
import { useTranslator } from "@/components/i18n/LocaleProvider";

type AccountManagerTaskMonitoringPanelProps = {
  projects: any[];
  filteredTasks: any[];
  taskFilterClient: string;
  setTaskFilterClient: (value: string) => void;
  taskFilterStatus: string;
  setTaskFilterStatus: (value: string) => void;
  taskFilterTeam: string;
  setTaskFilterTeam: (value: string) => void;
  openClientJourney: (projectId: string) => void;
};

export default function AccountManagerTaskMonitoringPanel({
  projects,
  filteredTasks,
  taskFilterClient,
  setTaskFilterClient,
  taskFilterStatus,
  setTaskFilterStatus,
  taskFilterTeam,
  setTaskFilterTeam,
  openClientJourney,
}: AccountManagerTaskMonitoringPanelProps) {
  const t = useTranslator();
  return (
    <div className="bg-white rounded-xl shadow border overflow-hidden">
      <div className="p-4 border-b bg-slate-50 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div>
          <h2 className="text-lg font-bold text-slate-800">{t("am.globalMonitoring")}</h2>
          <p className="text-xs text-slate-500">{t("am.globalMonitoringHint")}</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <select value={taskFilterClient} onChange={e => setTaskFilterClient(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-indigo-500 flex-1 md:flex-none">
            <option value="">{t("am.allClients")}</option>
            {projects.map((p: any) => <option key={p.id} value={p.id}>{p.deal?.lead?.name}</option>)}
          </select>
          <select value={taskFilterStatus} onChange={e => setTaskFilterStatus(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-indigo-500 flex-1 md:flex-none">
            <option value="">{t("filter.allStatuses")}</option>
            <option value="pending">{t("status.pending")}</option>
            <option value="in_progress">{t("status.inProgress")}</option>
            <option value="review">{t("status.review")}</option>
            <option value="done">{t("status.done")}</option>
          </select>
          <select value={taskFilterTeam} onChange={e => setTaskFilterTeam(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-indigo-500 flex-1 md:flex-none">
            <option value="">{t("filter.allTeams")}</option>
            <option value="seo">{t("team.seo")}</option>
            <option value="content_seo">{t("team.contentSeo")}</option>
            <option value="social_media">{t("team.socialMedia")}</option>
            <option value="media_buyer">{t("team.mediaBuyer")}</option>
            <option value="graphic_design">{t("team.graphicDesign")}</option>
            <option value="motion_graphic">{t("team.motionGraphic")}</option>
            <option value="ui_design">{t("team.uiUx")}</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase">
            <tr>
              <th className="px-6 py-3 text-start">{t("am.taskCore")}</th>
              <th className="px-6 py-3 text-start">{t("common.client")}</th>
              <th className="px-6 py-3 text-start">{t("am.assignment")}</th>
              <th className="px-6 py-3 text-center">{t("task.deadline")}</th>
              <th className="px-6 py-3 text-center">{t("common.status")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(() => {
              if (filteredTasks.length === 0) return (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-sm text-slate-400 italic">{t("task.noneMatch")}</td></tr>
              );

              return filteredTasks.map((t: any) => (
                <tr key={t.id} className="hover:bg-slate-50 transition">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-800 capitalize">{t.taskType.replace(/_/g, " ")}</div>
                    <div className="text-xs text-slate-500 max-w-[200px] truncate">{t.brief || "No brief"}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-semibold text-indigo-700 hover:underline cursor-pointer" onClick={() => openClientJourney(t.project.id)}>
                      {t.project?.deal?.lead?.name}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs text-slate-600">{t("am.byLabel")} <strong>{t.leader?.name || "System"}</strong></div>
                    <div className="text-xs text-slate-600">{t("am.toLabel")} <strong>{t.agent?.name || "Unassigned"}</strong></div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className={`text-sm font-medium ${t.deadline && new Date(t.deadline) < new Date() && t.status !== "done" ? "text-red-600 font-bold" : "text-slate-600"}`}>
                      {t.deadline ? new Date(t.deadline).toLocaleDateString() : "No Deadline"}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2 py-1 text-xs font-bold rounded-lg uppercase ${t.status === "done" ? "bg-emerald-100 text-emerald-700"
                      : t.status === "in_progress" ? "bg-amber-100 text-amber-700"
                        : t.status === "pending" ? "bg-blue-100 text-blue-700"
                          : "bg-slate-100 text-slate-600"
                      }`}>
                      {t.status.replace(/_/g, " ")}
                    </span>
                  </td>
                </tr>
              ));
            })()}
          </tbody>
        </table>
      </div>
    </div>
  );
}
