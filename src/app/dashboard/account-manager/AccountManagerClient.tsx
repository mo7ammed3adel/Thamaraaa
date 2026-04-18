"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, AlertTriangle, ListTodo, Clock, CheckCircle, Search, FileEdit } from "lucide-react";
import ClientDetailModal from "@/components/ClientDetailModal";
import CreateWarningModal from "@/components/CreateWarningModal";
import LifecycleStateBadge from "@/components/LifecycleStateBadge";
import LifecycleChangeModal from "@/components/LifecycleChangeModal";
import DistributeModal from "@/components/DistributeModal";
import TeamOverview from "@/components/TeamOverview";

export default function AccountManagerClient({ userId, projects, kpis }: any) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  // Task Panel States
  const [taskFilterClient, setTaskFilterClient] = useState("");
  const [taskFilterStatus, setTaskFilterStatus] = useState("");
  const [taskFilterTeam, setTaskFilterTeam] = useState("");
  const [activeKpi, setActiveKpi] = useState("all");

  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [warningModalOpen, setWarningModalOpen] = useState(false);
  const [warningTarget, setWarningTarget] = useState<{ projectId: string, clientId?: string } | null>(null);
  
  // Expanded row state
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Distribute & Lifecycle Modals
  const [distributeModalProject, setDistributeModalProject] = useState<any>(null);
  const [lifecycleModalProject, setLifecycleModalProject] = useState<any>(null);

  const filteredProjects = useMemo(() => {
    return projects.filter((p: any) => {
      const matchSearch = !searchQuery || (p.deal?.lead?.name?.toLowerCase().includes(searchQuery.toLowerCase()) || p.deal?.lead?.phone?.includes(searchQuery));
      let matchKpi = true;
      if (activeKpi === "active_clients") {
        matchKpi = ["in_progress", "setup"].includes(p.projectStatus);
      } else if (activeKpi === "warning_clients") {
        matchKpi = p.warnings && p.warnings.length > 0;
      } else if (activeKpi === "tasks_in_progress") {
        matchKpi = (p.tasks || []).some((t: any) => t.status === "in_progress");
      } else if (activeKpi === "tasks_delayed") {
        const now = new Date();
        matchKpi = (p.tasks || []).some((t: any) => t.deadline && new Date(t.deadline) < now && t.status !== "done");
      } else if (activeKpi === "tasks_done") {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        matchKpi = (p.tasks || []).some((t: any) => t.status === "done" && t.completedAt && new Date(t.completedAt) > oneWeekAgo);
      }
      return matchSearch && matchKpi;
    });
  }, [projects, searchQuery, activeKpi]);

  const filteredTasks = useMemo(() => {
    let allTasks = projects.flatMap((p: any) => (p.tasks || []).map((t: any) => ({ ...t, project: p })));

    if (taskFilterClient) allTasks = allTasks.filter((t: any) => t.projectId === taskFilterClient);
    if (taskFilterStatus) allTasks = allTasks.filter((t: any) => t.status === taskFilterStatus);
    if (taskFilterTeam) allTasks = allTasks.filter((t: any) => t.taskType === taskFilterTeam);

    if (activeKpi === "tasks_in_progress") {
      allTasks = allTasks.filter((t: any) => t.status === "in_progress");
    } else if (activeKpi === "tasks_delayed") {
      const now = new Date();
      allTasks = allTasks.filter((t: any) => t.deadline && new Date(t.deadline) < now && t.status !== "done");
    } else if (activeKpi === "tasks_done") {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      allTasks = allTasks.filter((t: any) => t.status === "done" && t.completedAt && new Date(t.completedAt) > oneWeekAgo);
    }

    // Sort pending/in_progress first
    return allTasks.sort((a: any, b: any) => {
      if (a.status !== "done" && b.status === "done") return -1;
      if (a.status === "done" && b.status !== "done") return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [projects, taskFilterClient, taskFilterStatus, taskFilterTeam, activeKpi]);

  const getProgressColor = (val: number) => val < 30 ? "bg-red-500" : val < 70 ? "bg-amber-400" : "bg-emerald-500";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">My Clients Dashboard</h1>
        <p className="text-sm text-slate-500">Welcome back. Here is the overview of your assigned projects.</p>
      </div>

      {/* ── KPI Grid ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <button onClick={() => setActiveKpi(activeKpi === "active_clients" ? "all" : "active_clients")} className={`p-4 rounded-xl border-2 text-left transition cursor-pointer ${activeKpi === "active_clients" ? "border-blue-500 bg-blue-50" : "border-transparent bg-white hover:bg-gray-50 shadow-sm"} flex flex-col justify-between`}>
          <div className="flex items-center gap-2 mb-2">
            <Briefcase className="w-5 h-5 text-blue-500" />
            <span className="text-[11px] font-bold uppercase text-gray-500">Active Clients</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{kpis.activeClients}</p>
        </button>

        <button onClick={() => setActiveKpi(activeKpi === "warning_clients" ? "all" : "warning_clients")} className={`p-4 rounded-xl border-2 text-left transition cursor-pointer ${activeKpi === "warning_clients" ? "border-red-500 bg-red-50" : "border-transparent bg-white hover:bg-gray-50 shadow-sm"} flex flex-col justify-between`}>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <span className="text-[11px] font-bold uppercase text-gray-500">Clients w/ Warnings</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{kpis.clientsWithWarnings}</p>
        </button>

        <button onClick={() => setActiveKpi(activeKpi === "tasks_in_progress" ? "all" : "tasks_in_progress")} className={`p-4 rounded-xl border-2 text-left transition cursor-pointer ${activeKpi === "tasks_in_progress" ? "border-amber-500 bg-amber-50" : "border-transparent bg-white hover:bg-gray-50 shadow-sm"} flex flex-col justify-between`}>
          <div className="flex items-center gap-2 mb-2">
            <ListTodo className="w-5 h-5 text-amber-500" />
            <span className="text-[11px] font-bold uppercase text-gray-500">Tasks In Progress</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{kpis.tasksInProgress}</p>
        </button>

        <button onClick={() => setActiveKpi(activeKpi === "tasks_delayed" ? "all" : "tasks_delayed")} className={`p-4 rounded-xl border-2 text-left transition cursor-pointer ${activeKpi === "tasks_delayed" ? "border-red-500 bg-red-50" : "border-transparent bg-white hover:bg-gray-50 shadow-sm"} flex flex-col justify-between`}>
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-red-500" />
            <span className="text-[11px] font-bold uppercase text-gray-500">Delayed Tasks</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{kpis.tasksDelayed}</p>
        </button>

        <button onClick={() => setActiveKpi(activeKpi === "tasks_done" ? "all" : "tasks_done")} className={`p-4 rounded-xl border-2 text-left transition cursor-pointer ${activeKpi === "tasks_done" ? "border-emerald-500 bg-emerald-50" : "border-transparent bg-white hover:bg-gray-50 shadow-sm"} flex flex-col justify-between`}>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-5 h-5 text-emerald-500" />
            <span className="text-[11px] font-bold uppercase text-gray-500">Tasks Done This Week</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{kpis.tasksDoneThisWeek}</p>
        </button>
      </div>

      {/* ── My Clients List ── */}
      <div className="bg-white rounded-xl shadow border overflow-hidden">
        <div className="p-4 border-b bg-slate-50 flex gap-4 items-center">
          <h2 className="text-lg font-bold text-slate-800 whitespace-nowrap">My Clients</h2>
          <input
            type="text"
            placeholder="Search by client name or phone..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="flex-1 max-w-sm border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase">
              <tr>
                <th className="px-6 py-3 text-left">Client Info</th>
                <th className="px-6 py-3 text-left">Start Date</th>
                <th className="px-6 py-3 text-left">Technical Progress</th>
                <th className="px-6 py-3 text-center">Lifecycle</th>
                <th className="px-6 py-3 text-center">Tasks</th>
                <th className="px-6 py-3 text-center">Last Activity</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredProjects.map((p: any) => {
                const activeTasks = p.tasks?.filter((t: any) => t.status !== "done").length || 0;
                const completedTasks = p.tasks?.filter((t: any) => t.status === "done").length || 0;
                const hasWarnings = p.warnings && p.warnings.length > 0;
                const lastActivity = p.logs && p.logs.length > 0 ? new Date(p.logs[0].createdAt).toLocaleDateString() : new Date(p.createdAt).toLocaleDateString();

                return (
                  <React.Fragment key={p.id}>
                  <tr className="hover:bg-slate-50 transition cursor-pointer" onClick={() => setExpandedRow(expandedRow === p.id ? null : p.id)}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="font-bold text-slate-900">{p.deal?.lead?.name}</div>
                        {hasWarnings && <span title="Active Warnings"><AlertTriangle className="w-4 h-4 text-red-500" /></span>}
                      </div>
                      <div className="text-xs text-slate-500 mt-1 uppercase font-medium bg-slate-100 w-fit px-2 py-0.5 rounded">{p.package}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-slate-700">
                        {p.deal?.contractStart ? new Date(p.deal.contractStart).toLocaleDateString() : "Pending"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="w-48 space-y-1">
                        {[{ label: "SEO", val: p.seoProgress }, { label: "SMM", val: p.socialMediaProgress }, { label: "Media", val: p.mediaBuyerProgress }].map((b) => (
                          <div key={b.label} className="flex items-center text-[10px]">
                            <span className="w-8 font-bold text-slate-400">{b.label}</span>
                            <div className="flex-1 bg-slate-100 h-1 mx-2 rounded-full overflow-hidden">
                              <div className={`${getProgressColor(b.val)} h-1`} style={{ width: `${b.val}%` }} />
                            </div>
                            <span className="w-6 text-right font-bold text-slate-600">{b.val.toFixed(0)}%</span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <LifecycleStateBadge state={p.lifecycleState || "Onboarding"} />
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
                    <td className="px-6 py-4 text-right space-y-2">
                      <div className="flex flex-col gap-2 relative">
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedClient(p); }}
                          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 shadow-sm transition inline-flex items-center justify-center gap-2"
                        >
                          Client Details <span>→</span>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setWarningTarget({ projectId: p.id, clientId: p.deal?.leadId }); setWarningModalOpen(true); }}
                          className="px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-bold hover:bg-red-100 transition inline-flex items-center justify-center gap-2"
                        >
                          <AlertTriangle className="w-3 h-3" /> Issue Warning
                        </button>
                      </div>
                    </td>
                  </tr>
                  
                  {/* Expanded Row */}
                  {expandedRow === p.id && (
                    <tr className="bg-slate-50/50">
                      <td colSpan={7} className="px-6 py-4 border-b border-t">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                          
                          {/* Left Column: Lifecycle & Distribution Controls */}
                          <div className="space-y-4">
                            <div className="bg-white p-4 rounded-lg border shadow-sm">
                              <h3 className="text-sm font-bold text-slate-800 mb-3 border-b pb-2">Client Governance</h3>
                              
                              <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                  <span className="text-xs text-slate-500 font-medium">Head Technical:</span>
                                  {p.headTechnicalId ? (
                                    <span className="text-sm font-semibold text-slate-700">{p.headTechnical?.name}</span>
                                  ) : (
                                    <span className="text-xs italic text-slate-400">Not assigned</span>
                                  )}
                                </div>
                                
                                <div className="flex justify-between items-center">
                                  <span className="text-xs text-slate-500 font-medium">Head SEO:</span>
                                  {p.headSeoId ? (
                                    <span className="text-sm font-semibold text-slate-700">{p.headSeo?.name}</span>
                                  ) : (
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); setDistributeModalProject(p); }}
                                      className="text-xs font-bold px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100 transition"
                                    >
                                      Distribute SEO Scope
                                    </button>
                                  )}
                                </div>

                                <div className="flex justify-between items-center pt-2 border-t mt-2">
                                  <span className="text-xs text-slate-500 font-medium">Lifecycle State:</span>
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); setLifecycleModalProject(p); }}
                                      className="text-xs font-bold px-3 py-1 bg-slate-100 text-slate-700 border rounded hover:bg-slate-200 transition"
                                    >
                                      Manage State
                                    </button>
                                </div>
                              </div>
                            </div>
                            
                            <div className="bg-white p-4 rounded-lg border shadow-sm">
                              <h3 className="text-sm font-bold text-slate-800 mb-3 border-b pb-2">Recent Notes</h3>
                              {p.notes && p.notes.length > 0 ? (
                                <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
                                  {p.notes.slice(0, 3).map((note: any) => (
                                    <div key={note.id} className="text-xs">
                                      <div className="flex justify-between text-slate-500 mb-1">
                                        <span className="font-semibold text-slate-700">{note.user?.name}</span>
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
                          
                          {/* Right Column: Team Overview */}
                          <div className="lg:col-span-2 space-y-3">
                            <h3 className="text-sm font-bold text-slate-800">Operational Teams</h3>
                            {(() => {
                              // Group team assignments by department
                              const assignments = p.teamAssignments || [];
                              const tasks = p.tasks || [];
                              const deptMap = new Map<string, any>();
                              
                              // First build from active assignments
                              assignments.forEach((assignment: any) => {
                                const dept = assignment.department;
                                if (!deptMap.has(dept)) {
                                  deptMap.set(dept, {
                                    department: dept,
                                    leader: null,
                                    agents: [],
                                    taskCounts: { hold: 0, inProgress: 0, done: 0, total: 0 },
                                    progressPercentage: 0
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
                              
                              // Check tasks to fill taskCounts per department
                              tasks.forEach((t: any) => {
                                const dept = t.taskType; // assuming taskType maps to department (mostly true)
                                // Only process if the department is in our map (assigned)
                                // or if it's not, we might create a ghost dept entry
                                if (!deptMap.has(dept)) {
                                  deptMap.set(dept, {
                                    department: dept,
                                    leader: null,
                                    agents: [],
                                    taskCounts: { hold: 0, inProgress: 0, done: 0, total: 0 },
                                    progressPercentage: 0
                                  });
                                }
                                
                                const deptObj = deptMap.get(dept);
                                deptObj.taskCounts.total++;
                                if (t.status === "done") deptObj.taskCounts.done++;
                                else if (t.status === "in_progress") deptObj.taskCounts.inProgress++;
                                else deptObj.taskCounts.hold++;
                              });

                              const teamsArray = Array.from(deptMap.values()).map(t => {
                                t.progressPercentage = t.taskCounts.total > 0 ? Math.round((t.taskCounts.done / t.taskCounts.total) * 100) : 0;
                                return t;
                              });

                              return <TeamOverview teams={teamsArray} />;
                            })()}
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
                    {searchQuery ? "No matched clients found." : "You have no clients assigned yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Global Task Monitoring Panel ── */}
      <div className="bg-white rounded-xl shadow border overflow-hidden">
        <div className="p-4 border-b bg-slate-50 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Global Task Monitoring</h2>
            <p className="text-xs text-slate-500">Track all active tasks across your portfolio</p>
          </div>
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <select value={taskFilterClient} onChange={e => setTaskFilterClient(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-indigo-500 flex-1 md:flex-none">
              <option value="">All Clients</option>
              {projects.map((p: any) => <option key={p.id} value={p.id}>{p.deal?.lead?.name}</option>)}
            </select>
            <select value={taskFilterStatus} onChange={e => setTaskFilterStatus(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-indigo-500 flex-1 md:flex-none">
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="review">Review</option>
              <option value="done">Done</option>
            </select>
            <select value={taskFilterTeam} onChange={e => setTaskFilterTeam(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-indigo-500 flex-1 md:flex-none">
              <option value="">All Teams</option>
              <option value="seo">SEO</option>
              <option value="content_seo">Content SEO</option>
              <option value="social_media">Social Media</option>
              <option value="media_buyer">Media Buyer</option>
              <option value="graphic_design">Graphic Design</option>
              <option value="motion_graphic">Motion Graphic</option>
              <option value="ui_design">UI/UX Design</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase">
              <tr>
                <th className="px-6 py-3 text-left">Task Core</th>
                <th className="px-6 py-3 text-left">Client</th>
                <th className="px-6 py-3 text-left">Assignment</th>
                <th className="px-6 py-3 text-center">Deadline</th>
                <th className="px-6 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(() => {
                if (filteredTasks.length === 0) return (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-sm text-slate-400 italic">No tasks match your filters.</td></tr>
                );

                return filteredTasks.map((t: any) => (
                  <tr key={t.id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-800 capitalize">{t.taskType.replace(/_/g, " ")}</div>
                      <div className="text-xs text-slate-500 max-w-[200px] truncate">{t.brief || "No brief"}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-semibold text-indigo-700 hover:underline cursor-pointer" onClick={() => router.push(`/dashboard/clients/${t.project.id}`)}>
                        {t.project?.deal?.lead?.name}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs text-slate-600">By: <strong>{t.leader?.name || "System"}</strong></div>
                      <div className="text-xs text-slate-600">To: <strong>{t.agent?.name || "Unassigned"}</strong></div>
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

      {selectedClient && (
        <ClientDetailModal
          isOpen={!!selectedClient}
          onClose={() => setSelectedClient(null)}
          project={selectedClient}
          currentUserRole="account_manager"
        />
      )}

      {warningTarget && (
        <CreateWarningModal
          isOpen={warningModalOpen}
          onClose={() => { setWarningModalOpen(false); setWarningTarget(null); }}
          projectId={warningTarget.projectId}
          clientId={warningTarget.clientId}
        />
      )}

      {distributeModalProject && (
        <DistributeModal
          isOpen={!!distributeModalProject}
          onClose={() => setDistributeModalProject(null)}
          projectId={distributeModalProject.id}
          projectName={distributeModalProject.deal?.lead?.name || "Client"}
          distributorRole="account_manager"
          preselectedTargetRole="head_seo"
        />
      )}

      {lifecycleModalProject && (
        <LifecycleChangeModal
          isOpen={!!lifecycleModalProject}
          onClose={() => setLifecycleModalProject(null)}
          projectId={lifecycleModalProject.id}
          projectName={lifecycleModalProject.deal?.lead?.name || "Client"}
          currentState={lifecycleModalProject.lifecycleState || "Onboarding"}
          onSuccess={() => { setLifecycleModalProject(null); router.refresh(); }}
        />
      )}
    </div>
  );
}
