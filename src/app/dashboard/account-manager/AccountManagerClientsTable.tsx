"use client";

import React from "react";
import { AlertTriangle, FileEdit, Send } from "lucide-react";
import LifecycleStateBadge from "@/components/LifecycleStateBadge";
import TeamOverview from "@/components/TeamOverview";
import DateRangeFilter from "@/components/dashboard/DateRangeFilter";
import { LIFECYCLE_STATE } from "@/lib/constants";

type AccountManagerClientsTableProps = {
  filteredProjects: any[];
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  filterLifecycle: string;
  setFilterLifecycle: (value: string) => void;
  lifecycleFromDate: string;
  setLifecycleFromDate: (value: string) => void;
  lifecycleToDate: string;
  setLifecycleToDate: (value: string) => void;
  expandedRow: string | null;
  setExpandedRow: (value: string | null) => void;
  loadingAction: string | null;
  handlePushToTeams: (projectId: string, packageType: string) => void;
  setSetupModalProject: (project: any) => void;
  setSelectedClient: (project: any) => void;
  setWarningTarget: (target: { projectId: string; clientId?: string } | null) => void;
  setWarningModalOpen: (isOpen: boolean) => void;
  setTechnicalModalProject: (project: any) => void;
  setDistributeModalProject: (project: any) => void;
  setLifecycleModalProject: (project: any) => void;
};

const getProgressColor = (val: number) => val < 30 ? "bg-red-500" : val < 70 ? "bg-amber-400" : "bg-emerald-500";

function buildTeamsOverview(project: any) {
  const assignments = project.teamAssignments || [];
  const tasks = project.tasks || [];
  const deptMap = new Map<string, any>();

  assignments.forEach((assignment: any) => {
    const dept = assignment.department;
    if (!deptMap.has(dept)) {
      deptMap.set(dept, {
        department: dept,
        leader: null,
        agents: [],
        taskCounts: { hold: 0, inProgress: 0, done: 0, total: 0 },
        progressPercentage: 0,
      });
    }

    const deptObj = deptMap.get(dept);
    const isLeader = assignment.role.includes("leader") || assignment.role.includes("head");

    if (isLeader) {
      deptObj.leader = assignment.user;
    } else {
      deptObj.agents.push(assignment.user);
    }
  });

  tasks.forEach((task: any) => {
    const dept = task.taskType;
    if (!deptMap.has(dept)) {
      deptMap.set(dept, {
        department: dept,
        leader: null,
        agents: [],
        taskCounts: { hold: 0, inProgress: 0, done: 0, total: 0 },
        progressPercentage: 0,
      });
    }

    const deptObj = deptMap.get(dept);
    deptObj.taskCounts.total++;
    if (task.status === "done") deptObj.taskCounts.done++;
    else if (task.status === "in_progress") deptObj.taskCounts.inProgress++;
    else deptObj.taskCounts.hold++;
  });

  return Array.from(deptMap.values()).map((team) => {
    team.progressPercentage = team.taskCounts.total > 0 ? Math.round((team.taskCounts.done / team.taskCounts.total) * 100) : 0;
    return team;
  });
}

export default function AccountManagerClientsTable({
  filteredProjects,
  searchQuery,
  setSearchQuery,
  filterLifecycle,
  setFilterLifecycle,
  lifecycleFromDate,
  setLifecycleFromDate,
  lifecycleToDate,
  setLifecycleToDate,
  expandedRow,
  setExpandedRow,
  loadingAction,
  handlePushToTeams,
  setSetupModalProject,
  setSelectedClient,
  setWarningTarget,
  setWarningModalOpen,
  setTechnicalModalProject,
  setDistributeModalProject,
  setLifecycleModalProject,
}: AccountManagerClientsTableProps) {
  const hasActiveClientFilters = Boolean(
    searchQuery || filterLifecycle !== "all" || lifecycleFromDate || lifecycleToDate
  );

  return (
    <div className="bg-white rounded-xl shadow border overflow-hidden">
      <div className="p-4 border-b bg-slate-50 space-y-3">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-end">
          <h2 className="text-lg font-bold text-slate-800 whitespace-nowrap lg:pb-2">My Clients</h2>
          <div className="flex flex-col sm:flex-row gap-3 flex-1">
            <label className="flex-1 max-w-sm">
              <span className="block text-xs font-semibold text-slate-500 mb-1 uppercase">Search</span>
              <input
                type="text"
                placeholder="Search by client name or phone..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
              />
            </label>
            <label className="w-full sm:w-52">
              <span className="block text-xs font-semibold text-slate-500 mb-1 uppercase">Client Status</span>
              <select
                value={filterLifecycle}
                onChange={(event) => setFilterLifecycle(event.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
              >
                <option value="all">All statuses</option>
                <option value={LIFECYCLE_STATE.ACTIVE}>Active</option>
                <option value={LIFECYCLE_STATE.HOLD}>Hold</option>
                <option value={LIFECYCLE_STATE.RENEWER}>Renewer</option>
                <option value={LIFECYCLE_STATE.LOST}>Lost</option>
              </select>
            </label>
          </div>
        </div>
        <DateRangeFilter
          fromDate={lifecycleFromDate}
          toDate={lifecycleToDate}
          onFromDateChange={setLifecycleFromDate}
          onToDateChange={setLifecycleToDate}
          label="Client Status Date"
          includeLastMonth
        />
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase">
            <tr>
              <th className="px-6 py-3 text-start">Client Info</th>
              <th className="px-6 py-3 text-start">Start Date</th>
              <th className="px-6 py-3 text-start">Technical Progress</th>
              <th className="px-6 py-3 text-center">Lifecycle</th>
              <th className="px-6 py-3 text-center">Tasks</th>
              <th className="px-6 py-3 text-center">Last Activity</th>
              <th className="px-6 py-3 text-end">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredProjects.map((project: any) => {
              const activeTasks = project.tasks?.filter((task: any) => task.status !== "done").length || 0;
              const completedTasks = project.tasks?.filter((task: any) => task.status === "done").length || 0;
              const hasWarnings = project.warnings && project.warnings.length > 0;
              const lastActivity = project.logs && project.logs.length > 0 ? new Date(project.logs[0].createdAt).toLocaleDateString() : new Date(project.createdAt).toLocaleDateString();

              return (
                <React.Fragment key={project.id}>
                  <tr className="hover:bg-slate-50 transition cursor-pointer" onClick={() => setExpandedRow(expandedRow === project.id ? null : project.id)}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="font-bold text-slate-900">{project.deal?.lead?.name}</div>
                        {hasWarnings && <span title="Active Warnings"><AlertTriangle className="w-4 h-4 text-red-500" /></span>}
                      </div>
                      <div className="text-xs text-slate-500 mt-1 uppercase font-medium bg-slate-100 w-fit px-2 py-0.5 rounded">{project.package}</div>
                      <div className="text-[10px] text-slate-500 mt-2 font-bold uppercase">{project.projectStatus.replace(/_/g, " ")}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-slate-700">
                        {project.deal?.contractStart ? new Date(project.deal.contractStart).toLocaleDateString() : "Pending"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="w-48 space-y-1">
                        {[{ label: "SEO", val: project.seoProgress }, { label: "SMM", val: project.socialMediaProgress }, { label: "Media", val: project.mediaBuyerProgress }].map((bar) => (
                          <div key={bar.label} className="flex items-center text-[10px]">
                            <span className="w-8 font-bold text-slate-400">{bar.label}</span>
                            <div className="flex-1 bg-slate-100 h-1 mx-2 rounded-full overflow-hidden">
                              <div className={`${getProgressColor(bar.val)} h-1`} style={{ width: `${bar.val}%` }} />
                            </div>
                            <span className="w-6 text-end font-bold text-slate-600">{bar.val.toFixed(0)}%</span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <LifecycleStateBadge state={project.lifecycleState || "Active"} />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex flex-col gap-1 items-center">
                        {activeTasks > 0 ? (
                          <span className="inline-flex items-center justify-center bg-blue-100 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-full">
                            {activeTasks} Active
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 font-medium">0 Active</span>
                        )}
                        <span className="text-xs text-emerald-600 font-bold">{completedTasks} Completed</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center text-sm font-medium text-slate-600">
                      {lastActivity}
                    </td>
                    <td className="px-6 py-4 text-end space-y-2">
                      <div className="flex flex-col gap-2 relative">
                        {project.projectStatus === "new" && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setSetupModalProject(project); }}
                            className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-medium hover:bg-slate-900 shadow-sm transition inline-flex items-center justify-center gap-2"
                          >
                            <FileEdit className="w-3 h-3" /> Setup Project
                          </button>
                        )}
                        {project.projectStatus === "setup" && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handlePushToTeams(project.id, project.package); }}
                            disabled={loadingAction === `push-${project.id}`}
                            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 shadow-sm transition disabled:opacity-50 inline-flex items-center justify-center gap-2"
                          >
                            <Send className="w-3 h-3" /> {loadingAction === `push-${project.id}` ? "Pushing..." : "Push to Teams"}
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedClient(project); }}
                          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 shadow-sm transition inline-flex items-center justify-center gap-2"
                        >
                          Client Details <span>→</span>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setWarningTarget({ projectId: project.id, clientId: project.deal?.leadId }); setWarningModalOpen(true); }}
                          className="px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-bold hover:bg-red-100 transition inline-flex items-center justify-center gap-2"
                        >
                          <AlertTriangle className="w-3 h-3" /> Issue Warning
                        </button>
                      </div>
                    </td>
                  </tr>

                  {expandedRow === project.id && (
                    <tr className="bg-slate-50/50">
                      <td colSpan={7} className="px-6 py-4 border-b border-t">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                          <div className="space-y-4">
                            <div className="bg-white p-4 rounded-lg border shadow-sm">
                              <h3 className="text-sm font-bold text-slate-800 mb-3 border-b pb-2">Client Governance</h3>

                              <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                  <span className="text-xs text-slate-500 font-medium">Head Technical:</span>
                                  {project.headTechnicalId ? (
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-semibold text-slate-700">{project.headTechnical?.name}</span>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); setTechnicalModalProject(project); }}
                                        className="text-[10px] font-bold px-2 py-1 bg-slate-100 text-slate-600 border rounded hover:bg-slate-200 transition"
                                      >
                                        Change
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setTechnicalModalProject(project); }}
                                      className="text-xs font-bold px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded hover:bg-indigo-100 transition"
                                    >
                                      Assign Head Technical
                                    </button>
                                  )}
                                </div>

                                <div className="flex justify-between items-center">
                                  <span className="text-xs text-slate-500 font-medium">Head SEO:</span>
                                  {project.headSeoId ? (
                                    <span className="text-sm font-semibold text-slate-700">{project.headSeo?.name}</span>
                                  ) : (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setDistributeModalProject(project); }}
                                      className="text-xs font-bold px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100 transition"
                                    >
                                      Distribute SEO Scope
                                    </button>
                                  )}
                                </div>

                                <div className="flex justify-between items-center pt-2 border-t mt-2">
                                  <span className="text-xs text-slate-500 font-medium">Lifecycle State:</span>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setLifecycleModalProject(project); }}
                                      className="text-xs font-bold px-3 py-1 bg-slate-100 text-slate-700 border rounded hover:bg-slate-200 transition"
                                    >
                                      Manage State
                                    </button>
                                </div>
                              </div>
                            </div>

                            <div className="bg-white p-4 rounded-lg border shadow-sm">
                              <h3 className="text-sm font-bold text-slate-800 mb-3 border-b pb-2">Recent Notes</h3>
                              {project.globalNotes && project.globalNotes.length > 0 ? (
                                <div className="space-y-3 max-h-48 overflow-y-auto pe-2">
                                  {project.globalNotes.slice(0, 3).map((note: any) => (
                                    <div key={note.id} className="text-xs">
                                      <div className="flex justify-between text-slate-500 mb-1">
                                        <span className="font-semibold text-slate-700">{note.userName || note.user?.name || note.userRole}</span>
                                        <span>{new Date(note.createdAt).toLocaleDateString()}</span>
                                      </div>
                                      <p className="text-slate-600 line-clamp-2">{note.content}</p>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-slate-400 italic">No notes found.</p>
                              )}
                            </div>
                          </div>

                          <div className="lg:col-span-2 space-y-3">
                            <h3 className="text-sm font-bold text-slate-800">Operational Teams</h3>
                            <TeamOverview teams={buildTeamsOverview(project)} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {filteredProjects.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-sm text-slate-400 italic">
                  {hasActiveClientFilters ? "No matched clients found." : "You have no clients assigned yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
