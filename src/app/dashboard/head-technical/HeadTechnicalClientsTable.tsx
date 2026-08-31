"use client";

import { AlertTriangle, Search, X } from "lucide-react";

import TeamWorkloadBadge from "@/components/TeamWorkloadBadge";
import {
  getDelayedTechnicalTasks,
  getDepartmentSummary,
  getHeadTechnicalDepartmentsToShow,
  getHeadTechnicalProgressColor,
  getMissingTechnicalDepartments,
  isHeadTechnicalTask,
} from "./useHeadTechnicalDerivedData";

import { useTranslator } from "@/components/i18n/LocaleProvider";
type HeadTechnicalClientsTableProps = {
  projects: any[];
  filteredProjects: any[];
  hasActiveFilters: boolean;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  clearAllFilters: () => void;
  openClientTeam: (projectId: string) => void;
  openClientJourney: (projectId: string) => void;
};

export default function HeadTechnicalClientsTable({
  projects,
  filteredProjects,
  hasActiveFilters,
  searchQuery,
  setSearchQuery,
  clearAllFilters,
  openClientTeam,
  openClientJourney,
}: HeadTechnicalClientsTableProps) {
  const t = useTranslator();
  return (
    <div className="bg-white rounded-xl shadow border overflow-hidden">
      <div className="p-4 border-b bg-slate-50 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-slate-800 whitespace-nowrap">Master Clients List</h2>
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 rounded-full hover:bg-red-100 transition"
            >
              <X className="w-3 h-3" /> Clear Filters
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder={t("form.searchClients")}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full ps-9 pe-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <span className="text-xs text-slate-400 self-center whitespace-nowrap">
            {filteredProjects.length} / {projects.length}
          </span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-start text-xs font-semibold text-slate-500 uppercase w-1/4">{t("common.clientName")}</th>
              <th className="px-6 py-3 text-start text-xs font-semibold text-slate-500 uppercase w-1/4">Assigned Teams</th>
              <th className="px-6 py-3 text-start text-xs font-semibold text-slate-500 uppercase w-1/4">Progress %</th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase w-32">Status & Delays</th>
              <th className="px-6 py-3 text-end text-xs font-semibold text-slate-500 uppercase">{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredProjects.map((project: any) => {
              const delayedTasks = getDelayedTechnicalTasks(project).length;
              const activeTasks = project.tasks?.filter((task: any) => isHeadTechnicalTask(task) && task.status !== "done").length || 0;
              const warningCount = project.warnings?.length || 0;
              const missingDepartments = getMissingTechnicalDepartments(project);
              const departmentsToShow = getHeadTechnicalDepartmentsToShow(project);

              return (
                <tr key={project.id} className="hover:bg-slate-50/50 transition">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-900">{project.deal?.lead?.name}</div>
                    <div className="text-xs text-slate-500">{project.deal?.lead?.phone}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-100 text-purple-800">{project.package}</span>
                      {activeTasks > 0 && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full">
                          {activeTasks} Active
                        </span>
                      )}
                      {warningCount > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 text-[10px] font-bold rounded-full">
                          <AlertTriangle className="w-3 h-3" /> {warningCount}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-2">
                      {departmentsToShow.map((department: string) => {
                        const dept = getDepartmentSummary(project, department);
                        return (
                          <TeamWorkloadBadge
                            key={department}
                            department={dept.department}
                            leader={dept.leader}
                            agentCount={dept.agentCount}
                            hasDelayedTasks={dept.hasDelayedTasks}
                          />
                        );
                      })}
                      {departmentsToShow.length === 0 && (
                        <span className="text-slate-400 italic text-xs">No social/media scope detected</span>
                      )}
                    </div>
                    {missingDepartments.length > 0 && (
                      <p className="text-[10px] font-bold text-purple-700 mt-2">
                        Missing TL: {missingDepartments.map((department: string) => department.replace(/_/g, " ")).join(", ")}
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="w-full space-y-1 max-w-xs">
                      {[{ label: "SMM", val: project.socialMediaProgress }, { label: "Media", val: project.mediaBuyerProgress }].map((bar) => (
                        <div key={bar.label} className="flex items-center text-[10px]">
                          <span className="w-8 font-bold text-slate-400">{bar.label}</span>
                          <div className="flex-1 bg-slate-100 h-1 mx-2 rounded-full overflow-hidden">
                            <div className={`${getHeadTechnicalProgressColor(bar.val)} h-1`} style={{ width: `${bar.val}%` }} />
                          </div>
                          <span className="w-6 text-end font-bold text-slate-600">{bar.val.toFixed(0)}%</span>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className={`px-2 py-0.5 text-[10px] rounded font-bold uppercase border ${project.projectStatus === "completed" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : project.projectStatus === "delayed" ? "bg-red-50 text-red-700 border-red-200" : project.projectStatus === "in_progress" ? "bg-blue-50 text-blue-700 border-blue-200" : project.projectStatus === "new" ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-slate-50 text-slate-700 border-slate-200"}`}>
                        {project.projectStatus.replace(/_/g, " ")}
                      </span>
                      {delayedTasks > 0 && <span className="text-[10px] text-red-600 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded font-bold">{delayedTasks} Delayed</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-end">
                    <div className="flex flex-col items-end gap-2">
                      <button onClick={() => openClientTeam(project.id)} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 shadow-sm transition w-28 text-center">
                        Distribute to Depts
                      </button>
                      <button onClick={() => openClientJourney(project.id)} className="px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-slate-900 shadow-sm transition w-28 text-center">
                        Full Journey â†’
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredProjects.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-sm text-slate-400 italic">
                  {hasActiveFilters ? "No clients match your current filters." : "No clients available."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
