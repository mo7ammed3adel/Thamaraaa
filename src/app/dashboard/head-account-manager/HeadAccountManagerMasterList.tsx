"use client";

import { AlertTriangle } from "lucide-react";
import LifecycleStateBadge from "@/components/LifecycleStateBadge";

type HeadAccountManagerMasterListProps = {
  filteredProjects: any[];
  accountManagers: any[];
  filterAM: string;
  setFilterAM: (value: string) => void;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  filterStatus: string;
  setFilterStatus: (value: string) => void;
  filterWarning: string;
  setFilterWarning: (value: string) => void;
  filterDelay: string;
  setFilterDelay: (value: string) => void;
  filterLifecycle: string;
  setFilterLifecycle: (value: string) => void;
  handleAssignAM: (projectId: string, amId: string) => void;
  setLifecycleProject: (project: any) => void;
  setSelectedClient: (project: any) => void;
  setDistributeProject: (project: any) => void;
  setDistributeSeoProject: (project: any) => void;
  setWarningProject: (project: any) => void;
  setReassignProject: (project: any) => void;
  openClientJourney: (projectId: string) => void;
};

const getProgressColor = (val: number) => val < 30 ? "bg-red-500" : val < 70 ? "bg-amber-400" : "bg-emerald-500";

export default function HeadAccountManagerMasterList({
  filteredProjects,
  accountManagers,
  filterAM,
  setFilterAM,
  searchQuery,
  setSearchQuery,
  filterStatus,
  setFilterStatus,
  filterWarning,
  setFilterWarning,
  filterDelay,
  setFilterDelay,
  filterLifecycle,
  setFilterLifecycle,
  handleAssignAM,
  setLifecycleProject,
  setSelectedClient,
  setDistributeProject,
  setDistributeSeoProject,
  setWarningProject,
  setReassignProject,
  openClientJourney,
}: HeadAccountManagerMasterListProps) {
  return (
    <div className="bg-white rounded-xl shadow border overflow-hidden">
      <div className="p-4 border-b bg-slate-50 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <h2 className="text-lg font-bold text-slate-800 whitespace-nowrap">Global Master List</h2>
          {filterAM !== "all" && (
            <button onClick={() => setFilterAM("all")} className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full hover:bg-indigo-100 whitespace-nowrap">
              Showing AM: {filterAM === "unassigned" ? "Unassigned" : accountManagers.find((a:any) => a.id === filterAM)?.name} ✕
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <input
            type="text"
            placeholder="Search clients..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full md:w-48 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
          />
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white outline-none">
            <option value="all">All Statuses</option>
            <option value="new">New</option>
            <option value="assigned">Assigned</option>
            <option value="setup">Setup</option>
            <option value="in_progress">In Progress</option>
            <option value="delayed">Delayed</option>
            <option value="completed">Completed</option>
          </select>
          <select value={filterWarning} onChange={e => setFilterWarning(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white outline-none">
            <option value="all">Warnings: Any</option>
            <option value="yes">With Warnings</option>
            <option value="no">No Warnings</option>
          </select>
          <select value={filterDelay} onChange={e => setFilterDelay(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white outline-none">
            <option value="all">Delay: Any</option>
            <option value="yes">Delayed Tasks/Project</option>
          </select>
          <select value={filterLifecycle} onChange={e => setFilterLifecycle(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white outline-none">
            <option value="all">Client Status: All</option>
            <option value="Active">Active</option>
            <option value="Hold">Hold</option>
            <option value="Renewer">Renewer</option>
            <option value="Lost">Lost</option>
          </select>
        </div>
      </div>

      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase">
          <tr>
            <th className="px-6 py-3 text-left w-64">Client & Details</th>
            <th className="px-6 py-3 text-left w-32">Lifecycle</th>
            <th className="px-6 py-3 text-left w-48">Assignments</th>
            <th className="px-6 py-3 text-left w-64">General Progress</th>
            <th className="px-6 py-3 text-center w-32">Status & Tasks</th>
            <th className="px-6 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {filteredProjects.map((p: any) => {
            const hasWarnings = p.warnings && p.warnings.length > 0;
            const activeTasks = p.tasks?.filter((t:any) => t.status !== "done").length || 0;
            const delayedTasks = p.tasks?.filter((t:any) => t.status !== "done" && t.deadline && new Date(t.deadline) < new Date()).length || 0;
            const lastActivity = p.logs && p.logs.length > 0 ? new Date(p.logs[0].createdAt).toLocaleDateString() : new Date(p.createdAt).toLocaleDateString();

            return (
              <tr key={p.id} className="hover:bg-slate-50 transition">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="font-bold text-slate-900">{p.deal?.lead?.name}</div>
                    {hasWarnings && <span title="Active Warnings"><AlertTriangle className="w-4 h-4 text-orange-500" /></span>}
                  </div>
                  <div className="text-xs text-slate-500 mb-1">{p.deal?.lead?.phone}</div>
                  <div className="flex gap-2 items-center">
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">{p.deal?.lead?.source || "Direct"}</span>
                    <span className="text-xs text-purple-600 font-bold">{p.package}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-2">
                    <LifecycleStateBadge state={p.lifecycleState || "Active"} compact />
                    <button
                      onClick={() => setLifecycleProject(p)}
                      className="text-[10px] text-indigo-600 font-bold hover:underline"
                    >
                      Change
                    </button>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="space-y-2">
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">Account Manager</p>
                      <select
                        value={p.accountManagerId || ""}
                        onChange={(e) => handleAssignAM(p.id, e.target.value)}
                        className={`text-xs border rounded px-2 py-1 font-medium outline-none w-full ${!p.accountManagerId ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-white"}`}
                      >
                        <option value="">⚠️ Unassigned</option>
                        {accountManagers.map((am: any) => (
                          <option key={am.id} value={am.id}>{am.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">Head Technical</p>
                      <div className="text-xs font-semibold px-2 py-1 bg-slate-50 border rounded w-full truncate text-slate-500 cursor-not-allowed" title="Assigned through Client Full Journey Page">
                        {p.headTechnical?.name || "Pending Request"}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">Head SEO</p>
                      <div className="text-xs font-semibold px-2 py-1 bg-slate-50 border rounded w-full truncate text-slate-500 cursor-not-allowed" title="Assigned through Client Full Journey Page">
                        {p.headSeo?.name || "Pending Request"}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="w-full space-y-1">
                    {[{ label: "SEO", val: p.seoProgress }, { label: "SMM", val: p.socialMediaProgress }, { label: "Media", val: p.mediaBuyerProgress }].map((b) => (
                      <div key={b.label} className="flex items-center text-[10px]">
                        <span className="w-8 font-bold text-slate-400">{b.label}</span>
                        <div className="flex-1 bg-slate-100 h-1 mx-2 rounded-full overflow-hidden">
                          <div className={`${getProgressColor(b.val)} h-1`} style={{ width: `${b.val}%` }} />
                        </div>
                        <span className="w-6 text-right font-bold text-slate-600">{b.val.toFixed(0)}%</span>
                      </div>
                    ))}
                    <div className="text-[10px] text-slate-400 text-right mt-1 font-medium">Activity: {lastActivity}</div>
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                  <div className="flex flex-col gap-1 items-center">
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded capitalize border ${p.projectStatus === "completed" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : p.projectStatus === "delayed" ? "bg-red-50 text-red-700 border-red-200" : p.projectStatus === "in_progress" ? "bg-blue-50 text-blue-700 border-blue-200" : p.projectStatus === "new" ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-slate-50 text-slate-700 border-slate-200"}`}>
                      {p.projectStatus.replace(/_/g, " ")}
                    </span>
                    <div className="text-xs text-slate-500 font-medium mt-1 whitespace-nowrap">
                      {activeTasks} Active
                    </div>
                    {delayedTasks > 0 && <span className="text-[10px] text-red-600 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded font-bold">{delayedTasks} Delayed Tasks</span>}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex flex-col gap-1 items-end">
                    <button onClick={() => setSelectedClient(p)} className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-medium hover:bg-slate-900 shadow-sm transition inline-flex items-center gap-2 whitespace-nowrap">
                      Client Center <span>→</span>
                    </button>
                    <button onClick={() => setDistributeProject(p)} className="text-[10px] text-purple-600 font-bold hover:underline mt-1">
                      Assign Head Technical
                    </button>
                    <button onClick={() => setDistributeSeoProject(p)} className="text-[10px] text-teal-600 font-bold hover:underline">
                      Assign Head SEO
                    </button>
                    <button onClick={() => { setWarningProject(p); }} className="text-[10px] text-red-600 font-bold hover:underline">
                      ⚠ Send Warning
                    </button>
                    <button onClick={() => openClientJourney(p.id)} className="text-[10px] text-indigo-600 font-bold hover:underline">
                      Full Portal UI
                    </button>
                    {p.accountManagerId && (
                      <button onClick={() => setReassignProject(p)} className="text-[10px] text-orange-600 font-bold hover:underline">
                        Reassign AM
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
          {filteredProjects.length === 0 && (
            <tr><td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-400 italic">No projects found for current filters.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
