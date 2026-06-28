"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Search, X } from "lucide-react";

import TeamWorkloadBadge from "@/components/TeamWorkloadBadge";
import LifecycleStateBadge from "@/components/LifecycleStateBadge";
import {
  getDelayedTechnicalTasks,
  getDepartmentSummary,
  getHeadTechnicalDepartmentsToShow,
  getHeadTechnicalProgressColor,
  getMissingTechnicalDepartments,
  isHeadTechnicalTask,
  useHeadTechnicalDerivedData,
} from "./useHeadTechnicalDerivedData";

export default function HeadTechnicalClient({ projects, teamLeaders, kpis, userId }: any) {
  const router = useRouter();
  const [taskFilter, setTaskFilter] = useState("all");
  const [activeKpi, setActiveKpi] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const { filteredProjects, hasActiveFilters, visibleTasks } = useHeadTechnicalDerivedData({
    projects,
    allTasks: kpis.allTasks,
    activeKpi,
    searchQuery,
    taskFilter,
  });

  const clearAllFilters = () => {
    setSearchQuery("");
    setActiveKpi("all");
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
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

      {/* Team Leaders Workload */}
      <div className="bg-white rounded-xl shadow border p-5">
        <h2 className="text-lg font-bold text-slate-800 mb-4">Technical Team Leaders Workload</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {teamLeaders.map((leader: any) => (
            <div key={leader.id} className="border rounded-lg p-4 bg-slate-50">
              <p className="text-sm font-bold text-slate-800 truncate" title={leader.name}>{leader.name}</p>
              <p className="text-xs text-slate-500 capitalize mt-0.5">{leader.role.replace(/_/g, " ")}</p>
              <div className="mt-3 flex items-end justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-400">Active Assignments</span>
                <span className="text-2xl font-black text-indigo-700">{leader._count?.teamAssignments || 0}</span>
              </div>
            </div>
          ))}
          {teamLeaders.length === 0 && (
            <p className="text-sm text-slate-400 italic">No active Social Media or Media Buyer team leaders found.</p>
          )}
        </div>
      </div>

      {/* Projects Table */}
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
                placeholder="Search clients..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
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
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase w-1/4">Client Name</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase w-1/4">Assigned Teams</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase w-1/4">Progress %</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase w-32">Status & Delays</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredProjects.map((p: any) => {
                const delayedTasks = getDelayedTechnicalTasks(p).length;
                const activeTasks = p.tasks?.filter((t: any) => isHeadTechnicalTask(t) && t.status !== "done").length || 0;
                const warningCount = p.warnings?.length || 0;
                const missingDepartments = getMissingTechnicalDepartments(p);
                const departmentsToShow = getHeadTechnicalDepartmentsToShow(p);
                
                return (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900">{p.deal?.lead?.name}</div>
                      <div className="text-xs text-slate-500">{p.deal?.lead?.phone}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-100 text-purple-800">{p.package}</span>
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
                          const dept = getDepartmentSummary(p, department);
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
                        {[{ label: "SMM", val: p.socialMediaProgress }, { label: "Media", val: p.mediaBuyerProgress }].map((b) => (
                          <div key={b.label} className="flex items-center text-[10px]">
                            <span className="w-8 font-bold text-slate-400">{b.label}</span>
                            <div className="flex-1 bg-slate-100 h-1 mx-2 rounded-full overflow-hidden">
                              <div className={`${getHeadTechnicalProgressColor(b.val)} h-1`} style={{ width: `${b.val}%` }} />
                            </div>
                            <span className="w-6 text-right font-bold text-slate-600">{b.val.toFixed(0)}%</span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className={`px-2 py-0.5 text-[10px] rounded font-bold uppercase border ${p.projectStatus === "completed" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : p.projectStatus === "delayed" ? "bg-red-50 text-red-700 border-red-200" : p.projectStatus === "in_progress" ? "bg-blue-50 text-blue-700 border-blue-200" : p.projectStatus === "new" ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-slate-50 text-slate-700 border-slate-200"}`}>
                          {p.projectStatus.replace(/_/g, " ")}
                        </span>
                        {delayedTasks > 0 && <span className="text-[10px] text-red-600 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded font-bold">{delayedTasks} Delayed</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex flex-col items-end gap-2">
                        <button onClick={() => router.push(`/dashboard/clients/${p.id}?tab=team`)} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 shadow-sm transition w-28 text-center">
                          Distribute to Depts
                        </button>
                        <button onClick={() => router.push(`/dashboard/clients/${p.id}`)} className="px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-slate-900 shadow-sm transition w-28 text-center">
                          Full Journey →
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

      {/* Tasks Overview (Global) */}
      <div className="bg-white rounded-xl shadow border overflow-hidden">
        <div className="p-4 border-b bg-slate-50 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-800">Global Tasks Execution</h2>
          <div className="flex items-center gap-3">
            <select value={taskFilter} onChange={(e) => setTaskFilter(e.target.value)} className="text-sm border rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="delayed">Delayed</option>
              <option value="done">Done</option>
            </select>
            {taskFilter !== "all" && (
              <button
                onClick={() => setTaskFilter("all")}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition"
              >
                <X className="w-3 h-3" /> Clear
              </button>
            )}
            <span className="text-xs text-slate-400">
              {kpis.allTasks.filter((t:any) => {
                if(taskFilter === "all") return true;
                if(taskFilter === "delayed") return t.status !== "done" && t.deadline && new Date(t.deadline) < new Date();
                return t.status === taskFilter;
              }).length} tasks
            </span>
          </div>
        </div>
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="min-w-full divide-y divide-gray-200 relative">
            <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Target Client</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Task Type & Brief</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Assigned Leader</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Deadline</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {visibleTasks.map((t: any) => {
                const isDelayed = t.status !== "done" && t.deadline && new Date(t.deadline) < new Date();
                const parentProject = projects.find((p:any) => p.id === t.projectId);
                return (
                 <tr key={t.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="font-bold text-slate-900 text-sm">{parentProject?.deal?.lead?.name || "Unknown"}</div>
                        {parentProject?.lifecycleState && <LifecycleStateBadge state={parentProject.lifecycleState} />}
                      </div>
                      <div className="text-xs text-slate-500">Project: {parentProject?.package || "N/A"}</div>
                    </td>
                    <td className="px-6 py-4 line-clamp-2 max-w-xs">
                      <span className="font-bold text-[10px] uppercase bg-slate-100 px-2 py-0.5 rounded text-slate-600 mr-2">{t.taskType.replace(/_/g, " ")}</span>
                      <span className="text-sm text-slate-700">{t.brief}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-semibold text-slate-800">{t.leader?.name || "Not Assigned"}</div>
                      <div className="text-xs text-slate-500">{t.agent?.name ? `Agent: ${t.agent.name}` : "Pending Agent"}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`text-sm font-medium ${isDelayed ? "text-red-600" : "text-slate-600"}`}>
                        {t.deadline ? new Date(t.deadline).toLocaleDateString() : "No Deadline"}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-0.5 text-[10px] rounded font-bold uppercase border ${t.status === "done" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : isDelayed ? "bg-red-50 text-red-700 border-red-200" : t.status === "in_progress" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-slate-50 text-slate-700 border-slate-200"}`}>
                        {isDelayed ? "DELAYED" : t.status.replace(/_/g, " ")}
                      </span>
                    </td>
                 </tr>
                )
              })}
              {kpis.allTasks.length === 0 && (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-sm text-slate-400 italic">No operational tasks generated yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
