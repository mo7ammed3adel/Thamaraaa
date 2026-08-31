"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Inbox, Clock, CheckCircle, AlertTriangle, Users, ExternalLink, Plus, ChevronDown, ChevronUp
} from "lucide-react";
import TaskFlagModal from "@/components/TaskFlagModal";
import TaskReassignModal from "@/components/TaskReassignModal";
import SelfTaskForm from "@/components/SelfTaskForm";
import TaskWorkspaceModal from "@/components/TaskWorkspaceModal";
import { updateTask } from "@/client/api/tasks";

/**
 * Design & Creative department client component (Graphic, Motion, UI/UX).
 * Full-spec implementation with Leader tabs (Incoming, My Team, All Tasks)
 * and Agent-focused task execution view.
 */
export default function DesignClient({ tasks, agents, userRole, userId, teamLabel, crossTeamTasks = [] }: any) {
  const router = useRouter();
  const isLeader = userRole.startsWith("leader_") || userRole === "super_admin";
  const [activeTab, setActiveTab] = useState(isLeader ? "incoming" : "tasks");
  const [activeKpi, setActiveKpi] = useState("all");
  const [flagTask, setFlagTask] = useState<any>(null);
  const [reassignTask, setReassignTask] = useState<any>(null);
  const [workspaceTask, setWorkspaceTask] = useState<any>(null);
  const [selfTaskProject, setSelfTaskProject] = useState<string | null>(null);
  const [expandedCrossTeam, setExpandedCrossTeam] = useState(false);

  // ── Advanced Filters ──
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  // ── Derived Data ──
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const incomingTasks = tasks.filter((t: any) => !t.agentId);
  const delayedTasks = tasks.filter((t: any) => t.status !== "done" && t.deadline && new Date(t.deadline) < now);
  const completedThisWeek = tasks.filter((t: any) => t.status === "done" && t.completedAt && new Date(t.completedAt) >= weekAgo);

  // ── KPIs ──
  const kpis = isLeader
    ? [
        { id: "incoming", icon: Inbox, label: "Incoming New", val: incomingTasks.length, colors: "border-transparent bg-white hover:bg-gray-50", icn: "text-violet-500", activeColors: "border-violet-500 bg-violet-50", defaultTab: "incoming" as string | undefined, disableFilter: false },
        { id: "in_progress", icon: Clock, label: "In Progress", val: tasks.filter((t: any) => t.status === "in_progress").length, colors: "border-transparent bg-white hover:bg-gray-50", icn: "text-amber-500", activeColors: "border-amber-500 bg-amber-50", defaultTab: "all" as string | undefined, disableFilter: false },
        { id: "done_time", icon: CheckCircle, label: "Done This Week", val: completedThisWeek.length, colors: "border-transparent bg-white hover:bg-gray-50", icn: "text-emerald-500", activeColors: "border-emerald-500 bg-emerald-50", defaultTab: "all" as string | undefined, disableFilter: false },
        { id: "delayed", icon: AlertTriangle, label: "Delayed", val: delayedTasks.length, colors: "border-transparent bg-white hover:bg-gray-50", icn: "text-red-500", activeColors: "border-red-500 bg-red-50", defaultTab: "all" as string | undefined, disableFilter: false },
        { id: "team", icon: Users, label: "Team Size", val: agents.length, colors: "border-transparent bg-white", icn: "text-slate-500", activeColors: "border-slate-500 bg-slate-50", defaultTab: undefined as string | undefined, disableFilter: true },
      ]
    : [
        { id: "pending", icon: Inbox, label: "Pending", val: tasks.filter((t: any) => t.status === "pending").length, colors: "border-transparent bg-white hover:bg-gray-50", icn: "text-slate-500", activeColors: "border-slate-500 bg-slate-50", defaultTab: undefined as string | undefined, disableFilter: false },
        { id: "in_progress", icon: Clock, label: "In Progress", val: tasks.filter((t: any) => t.status === "in_progress").length, colors: "border-transparent bg-white hover:bg-gray-50", icn: "text-amber-500", activeColors: "border-amber-500 bg-amber-50", defaultTab: undefined as string | undefined, disableFilter: false },
        { id: "done", icon: CheckCircle, label: "Completed", val: tasks.filter((t: any) => t.status === "done").length, colors: "border-transparent bg-white hover:bg-gray-50", icn: "text-emerald-500", activeColors: "border-emerald-500 bg-emerald-50", defaultTab: undefined as string | undefined, disableFilter: false },
        { id: "delayed", icon: AlertTriangle, label: "Delayed", val: delayedTasks.length, colors: "border-transparent bg-white hover:bg-gray-50", icn: "text-red-500", activeColors: "border-red-500 bg-red-50", defaultTab: undefined as string | undefined, disableFilter: false },
      ];

  // ── Filter logic ──
  const filteredTasks = tasks.filter((t: any) => {
    const matchesSearch =
      !searchQuery ||
      t.project?.deal?.lead?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.brief?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.requesterRole?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || t.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || t.priority === priorityFilter;

    let matchesKpi = true;
    if (activeKpi === "incoming") matchesKpi = !t.agentId;
    else if (activeKpi === "in_progress") matchesKpi = t.status === "in_progress";
    else if (activeKpi === "done_time") matchesKpi = t.status === "done" && t.completedAt && new Date(t.completedAt) >= weekAgo;
    else if (activeKpi === "delayed") matchesKpi = t.status !== "done" && t.deadline && new Date(t.deadline) < now;
    else if (activeKpi === "pending") matchesKpi = t.status === "pending";
    else if (activeKpi === "done") matchesKpi = t.status === "done";

    return matchesSearch && matchesStatus && matchesPriority && matchesKpi;
  });

  // ── Handlers ──
  async function handleAssign(taskId: string, agentId: string) {
    if (!agentId) return;
    await updateTask(taskId, { agentId, status: "pending" });
    router.refresh();
  }

  async function handleUpdateStatus(taskId: string, status: string) {
    await updateTask(taskId, { status, ...(status === "done" ? { completedAt: new Date().toISOString() } : {}) });
    router.refresh();
  }

  // ── Task Card (reusable) ──
  function TaskCard({ t, showAssign }: { t: any; showAssign: boolean }) {
    const lead = t.project?.deal?.lead;
    const isDelayed = t.status !== "done" && t.deadline && new Date(t.deadline) < now;

    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition">
        {/* Card Header */}
        <div className="bg-gray-50 border-b border-gray-100 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="text-lg font-bold text-gray-900">{lead?.name || "Client"}</h3>
              <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${t.status === "done" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : isDelayed ? "bg-red-50 text-red-700 border-red-200" : t.status === "in_progress" ? "bg-amber-50 text-amber-700 border-amber-200" : t.status === "review" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-slate-100 text-slate-600 border-slate-200"}`}>
                {isDelayed ? "DELAYED" : (t.status || "pending").replace(/_/g, " ")}
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${t.priority === "High" ? "bg-red-50 text-red-700 border-red-200" : "bg-slate-50 text-slate-600 border-slate-200"}`}>{t.priority || "Medium"}</span>
              {t.requesterRole === t.agent?.role && t.agentId === userId && (
                <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-bold rounded uppercase border border-emerald-200">Self</span>
              )}
              {t.parentTask && (
                <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  From: {t.parentTask.taskType.replace(/_/g, " ")}
                </span>
              )}
              {(t.project?.warnings?.length || 0) > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-red-100 text-red-700 border border-red-200">
                  <AlertTriangle className="w-3 h-3" /> {t.project.warnings.length} Warning
                </span>
              )}
            </div>
            {t.brief && <p className="text-sm text-gray-600 mt-1">{t.brief}</p>}
          </div>
          {t.deadline && (
            <div className="text-end shrink-0">
              <p className="text-xs text-gray-500 font-medium">Deadline</p>
              <p className={`text-sm font-bold ${isDelayed ? "text-red-600" : "text-gray-800"}`}>{new Date(t.deadline).toLocaleDateString()}</p>
            </div>
          )}
        </div>

        {/* Card Body */}
        <div className="px-6 py-5 flex flex-col md:flex-row gap-6">
          <div className="flex-1 space-y-4">
            <div className="flex gap-8 flex-wrap">
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">Requester</p>
                <p className="text-sm font-semibold text-gray-800">{t.requesterRole?.replace(/_/g, " ") || "System"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">Assigned Agent</p>
                <p className="text-sm font-semibold text-gray-800">{t.agent?.name || <span className="text-gray-400 italic">Not Assigned</span>}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">Created</p>
                <p className="text-sm font-semibold text-gray-800">{new Date(t.createdAt).toLocaleDateString()}</p>
              </div>
            </div>

            {/* Progress Bar */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-bold text-gray-600">Progress</span>
                <span className="font-bold text-violet-600">{t.progressPct}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div className="bg-violet-500 h-2 rounded-full transition-all duration-500" style={{ width: `${t.progressPct}%` }} />
              </div>
            </div>
          </div>

          {/* Actions Sidebar */}
          <div className="w-full md:w-64 space-y-3 border-t md:border-t-0 md:border-l border-gray-100 pt-4 md:pt-0 md:ps-6 shrink-0 flex flex-col justify-center">
            {/* Leader: Assign to Agent */}
            {showAssign && isLeader && !t.agentId && agents.length > 0 && (
              <div>
                <p className="text-xs font-bold text-gray-700 mb-1">Assign to Designer</p>
                <select onChange={(e) => handleAssign(t.id, e.target.value)} className="text-sm border-2 border-violet-100 rounded-xl px-3 py-2 text-violet-800 font-medium bg-violet-50 w-full outline-none focus:border-violet-500 transition">
                  <option value="">Select designer...</option>
                  {agents.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            )}

            {/* Workspace: progress, deliverables, checklist, notes */}
            {((!isLeader && t.agentId === userId) || isLeader) && (
              <button
                onClick={() => setWorkspaceTask(t)}
                className="w-full py-2 bg-violet-600 text-white rounded-xl text-sm font-bold hover:bg-violet-700 shadow-sm transition"
              >
                🎨 Open Workspace
              </button>
            )}

            <div className="grid grid-cols-1 gap-2 pt-2">
              {/* The assigned designer drives the work up to review */}
              {t.agentId === userId && t.status !== "in_progress" && t.status !== "done" && t.status !== "review" && (
                <button onClick={() => handleUpdateStatus(t.id, "in_progress")} className="w-full py-2 bg-gray-800 text-white rounded-xl text-sm font-bold hover:bg-gray-900 shadow-sm transition">Start Task</button>
              )}
              {t.agentId === userId && t.status === "in_progress" && (
                <button onClick={() => handleUpdateStatus(t.id, "review")} className="w-full py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 shadow-sm transition">Submit for Review</button>
              )}
              {/* Only the leader approves the final delivery */}
              {isLeader && t.status === "review" && (
                <button onClick={() => handleUpdateStatus(t.id, "done")} className="w-full py-2 bg-emerald-500 text-white rounded-xl text-sm font-bold hover:bg-emerald-600 shadow-sm transition">Mark Delivered</button>
              )}
              {!isLeader && t.agentId === userId && t.status === "review" && (
                <span className="w-full py-2 text-center bg-blue-50 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold">Awaiting leader review</span>
              )}
            </div>

            {/* View Client Full Journey */}
            <Link
              href={`/dashboard/clients/${t.projectId}`}
              className="w-full py-2 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-900 shadow-sm transition flex items-center justify-center gap-2"
            >
              <ExternalLink className="w-4 h-4" /> Client Full Journey
            </Link>

            {/* Leader Reassign Button */}
            {isLeader && t.agentId && t.status !== "done" && (
              <button
                onClick={() => setReassignTask(t)}
                className="w-full py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl text-sm font-bold hover:bg-blue-100 shadow-sm transition"
              >
                ⇄ Reassign Agent
              </button>
            )}

            {/* Agent Flag Button */}
            {!isLeader && t.agentId === userId && t.status !== "done" && (
              <button
                onClick={() => setFlagTask(t)}
                className="w-full py-2 bg-orange-50 text-orange-700 border border-orange-200 rounded-xl text-sm font-bold hover:bg-orange-100 shadow-sm transition"
              >
                ⚑ Flag / Return Task
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Section Title ── */}
      <h2 className="text-lg font-bold text-slate-800">{isLeader ? `${teamLabel} Projects` : `My ${teamLabel} Tasks`}</h2>

      {/* KPI Overview */}
      <div className={`grid grid-cols-2 ${isLeader ? "md:grid-cols-5" : "md:grid-cols-4"} gap-4`}>
        {kpis.map((k, i) => (
          <button 
            key={i} 
            onClick={() => {
              if (k.disableFilter) return;
              const newKpi = activeKpi === k.id ? "all" : k.id;
              setActiveKpi(newKpi);
              if (k.defaultTab && newKpi !== "all") setActiveTab(k.defaultTab);
            }}
            className={`p-4 rounded-xl border-2 transition text-start flex flex-col justify-between ${k.disableFilter ? "cursor-default shadow-sm" : "cursor-pointer"} ${activeKpi === k.id ? k.activeColors : `${k.colors} ${k.disableFilter ? "" : "shadow-sm"}`}`}
          >
            <div className={`flex items-center gap-2 mb-2 ${k.icn}`}>
              <k.icon className="w-5 h-5" />
              <span className="text-[11px] font-bold uppercase tracking-wider">{k.label}</span>
            </div>
            <p className="text-2xl font-black mt-1 text-slate-900">{k.val}</p>
          </button>
        ))}
      </div>

      {/* Tabs (Leader Only) */}
      {isLeader && (
        <div className="flex border-b border-gray-200">
          <button onClick={() => setActiveTab("incoming")} className={`px-6 py-3 font-semibold text-sm border-b-2 transition ${activeTab === "incoming" ? "border-violet-600 text-violet-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            📥 Incoming ({incomingTasks.length})
          </button>
          <button onClick={() => setActiveTab("team")} className={`px-6 py-3 font-semibold text-sm border-b-2 transition ${activeTab === "team" ? "border-violet-600 text-violet-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            👥 My Team
          </button>
          <button onClick={() => setActiveTab("all")} className={`px-6 py-3 font-semibold text-sm border-b-2 transition ${activeTab === "all" ? "border-violet-600 text-violet-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            📋 All Tasks
          </button>
        </div>
      )}

      {/* ═══════════ LEADER: INCOMING TASKS ═══════════ */}
      {isLeader && activeTab === "incoming" && (
        <div className="space-y-4">
          {incomingTasks.length === 0 && (
            <div className="bg-gray-50 border border-dashed border-gray-300 rounded-2xl p-12 text-center text-gray-500">No new incoming requests!</div>
          )}
          {incomingTasks.map((t: any) => <TaskCard key={t.id} t={t} showAssign={true} />)}
        </div>
      )}

      {/* ═══════════ LEADER: MY TEAM ═══════════ */}
      {isLeader && activeTab === "team" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {agents.map((agent: any) => {
            const agentTasks = tasks.filter((t: any) => t.agentId === agent.id);
            const activeT = agentTasks.filter((t: any) => t.status === "in_progress");
            const doneT = agentTasks.filter((t: any) => t.status === "done");
            const delayedT = agentTasks.filter((t: any) => t.status !== "done" && t.deadline && new Date(t.deadline) < now);

            return (
              <div key={agent.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 hover:shadow-md transition">
                <div className="flex items-center gap-4 mb-4">
                  <div className="h-12 w-12 rounded-full bg-violet-100 flex items-center justify-center text-xl font-bold text-violet-700">
                    {agent.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{agent.name}</h3>
                    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">{teamLabel} Agent</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">In Progress</span>
                    <span className="font-bold text-amber-600">{activeT.length}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Completed</span>
                    <span className="font-bold text-emerald-600">{doneT.length}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Delayed</span>
                    <span className={`font-bold ${delayedT.length > 0 ? "text-red-600" : "text-emerald-500"}`}>{delayedT.length}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Total Assigned</span>
                    <span className="font-bold text-gray-900">{agentTasks.length}</span>
                  </div>
                </div>
              </div>
            );
          })}
          {agents.length === 0 && (
            <div className="col-span-full bg-gray-50 border border-dashed border-gray-300 rounded-2xl p-12 text-center text-gray-500">No agents available.</div>
          )}
        </div>
      )}

      {/* ═══════════ LEADER: ALL TASKS / AGENT: MY TASKS ═══════════ */}
      {((!isLeader) || (isLeader && activeTab === "all")) && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl border p-4 shadow-sm">
            <input type="text" placeholder="🔍 Search client, brief, requester..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="flex-1 min-w-[200px] border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none" />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-violet-500 outline-none">
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="review">In Review</option>
              <option value="done">Delivered</option>
            </select>
            <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-violet-500 outline-none">
              <option value="all">All Priorities</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
            {(searchQuery || statusFilter !== "all" || priorityFilter !== "all") && (
              <button onClick={() => { setSearchQuery(""); setStatusFilter("all"); setPriorityFilter("all"); }} className="px-3 py-2 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition">✕ Clear</button>
            )}
            {!isLeader && (
              <button
                onClick={() => {
                  const firstProjectId = filteredTasks[0]?.projectId;
                  if (firstProjectId) setSelfTaskProject(firstProjectId);
                }}
                className="inline-flex items-center gap-1.5 bg-emerald-600 text-white text-xs font-bold px-3 py-2 rounded-lg hover:bg-emerald-700 transition shadow-sm ms-auto"
              >
                <Plus className="w-3.5 h-3.5" /> Add My Task
              </button>
            )}
          </div>

          <p className="text-xs text-gray-400">Showing {filteredTasks.length} of {tasks.length} requests</p>

          {filteredTasks.map((t: any) => <TaskCard key={t.id} t={t} showAssign={isLeader} />)}
          {filteredTasks.length === 0 && (
            <div className="bg-gray-50 border border-dashed border-gray-300 rounded-2xl p-12 text-center text-gray-500">No design requests match your filters.</div>
          )}
        </div>
      )}

      {/* ── Aggregated My Tasks (All Roles) ── */}
      {tasks.length > 0 && (
        <div className="bg-white rounded-xl shadow border overflow-hidden">
          <div className="p-4 border-b bg-slate-50">
            <h2 className="text-lg font-bold text-slate-800">My Tasks Overview</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-start text-xs font-semibold text-slate-500 uppercase">Client</th>
                  <th className="px-6 py-3 text-start text-xs font-semibold text-slate-500 uppercase">Task Type</th>
                  <th className="px-6 py-3 text-start text-xs font-semibold text-slate-500 uppercase">Brief</th>
                  <th className="px-6 py-3 text-start text-xs font-semibold text-slate-500 uppercase">Deadline</th>
                  <th className="px-6 py-3 text-start text-xs font-semibold text-slate-500 uppercase">Progress</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tasks.map((t: any) => {
                  const isDelayed = t.status !== "done" && t.deadline && new Date(t.deadline) < now;
                  return (
                    <tr key={t.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4 font-bold text-sm text-slate-900">{t.project?.deal?.lead?.name || "Unknown"}</td>
                      <td className="px-6 py-4"><span className="font-bold text-[10px] uppercase bg-violet-100 px-2 py-0.5 rounded text-violet-700">{t.taskType?.replace(/_/g, " ")}</span></td>
                      <td className="px-6 py-4 text-sm text-slate-700 max-w-xs truncate">{t.brief || "—"}</td>
                      <td className="px-6 py-4"><span className={`text-sm font-medium ${isDelayed ? "text-red-600" : "text-slate-600"}`}>{t.deadline ? new Date(t.deadline).toLocaleDateString() : "No Deadline"}</span></td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-100 rounded-full h-1.5 w-16">
                            <div className="bg-violet-500 h-1.5 rounded-full" style={{ width: `${t.progressPct || 0}%` }} />
                          </div>
                          <span className="text-xs font-bold text-violet-600">{t.progressPct || 0}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center"><span className={`px-2 py-0.5 text-[10px] rounded font-bold uppercase border ${t.status === "done" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : isDelayed ? "bg-red-50 text-red-700 border-red-200" : t.status === "in_progress" ? "bg-amber-50 text-amber-700 border-amber-200" : t.status === "review" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-slate-50 text-slate-700 border-slate-200"}`}>{isDelayed ? "DELAYED" : (t.status || "pending").replace(/_/g, " ")}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Cross-Team Tasks (Other Teams) for Agents ── */}
      {!isLeader && crossTeamTasks.length > 0 && (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <button
            onClick={() => setExpandedCrossTeam(prev => !prev)}
            className="w-full flex items-center justify-between px-4 py-3 bg-slate-100 hover:bg-slate-200 transition text-sm font-bold text-slate-700"
          >
            <span>👁️ Other Teams Tasks ({crossTeamTasks.length})</span>
            {expandedCrossTeam ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {expandedCrossTeam && (
            <div className="p-3 space-y-2 bg-white">
              {crossTeamTasks.map((ct: any) => {
                const deptColorMap: Record<string, { bg: string; text: string; border: string; icon: string }> = {
                  seo: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", icon: "🔍" },
                  content_seo: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", icon: "🔍" },
                  social_media: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200", icon: "📱" },
                  graphic_design: { bg: "bg-pink-50", text: "text-pink-700", border: "border-pink-200", icon: "🎨" },
                  motion_graphic: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200", icon: "🎬" },
                  ui_design: { bg: "bg-cyan-50", text: "text-cyan-700", border: "border-cyan-200", icon: "🖥️" },
                  media_buyer: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", icon: "📊" },
                  media_buying: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", icon: "📊" },
                };
                const defaultDept = { bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-200", icon: "📋" };
                const dept = deptColorMap[ct.taskType] || defaultDept;
                const isDelayed = ct.status !== "done" && ct.deadline && new Date(ct.deadline) < new Date();
                const clientName = ct.project?.deal?.lead?.name || "Unknown Client";

                return (
                  <div key={ct.id} className={`${dept.bg} ${dept.border} border rounded-lg p-3`}>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{dept.icon}</span>
                        <span className={`text-[10px] font-bold uppercase ${dept.text}`}>{ct.taskType.replace(/_/g, " ")}</span>
                        <span className="text-[10px] text-slate-500 font-medium">• {clientName}</span>
                        <span className={`px-1.5 py-0.5 text-[9px] rounded font-bold uppercase border ${
                          ct.status === "done" ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                          isDelayed ? "bg-red-100 text-red-700 border-red-200" :
                          ct.status === "in_progress" ? "bg-amber-100 text-amber-700 border-amber-200" :
                          "bg-slate-100 text-slate-600 border-slate-200"
                        }`}>{isDelayed ? "DELAYED" : ct.status.replace(/_/g, " ")}</span>
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {ct.agent?.name || "Unassigned"}
                        {ct.deadline && (
                          <span className={`ms-2 ${isDelayed ? "text-red-600 font-bold" : ""}`}>
                            Due: {new Date(ct.deadline).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    {ct.brief && <p className="text-xs text-slate-600 mt-1.5 line-clamp-2">{ct.brief}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {flagTask && (
        <TaskFlagModal
          taskId={flagTask.id}
          taskName={flagTask.taskType?.replace(/_/g, " ") || "Design Task"}
          isOpen={!!flagTask}
          onClose={() => setFlagTask(null)}
          onSuccess={() => { setFlagTask(null); router.refresh(); }}
        />
      )}

      {reassignTask && (
        <TaskReassignModal
          taskId={reassignTask.id}
          taskName={reassignTask.taskType?.replace(/_/g, " ") || "Design Task"}
          taskType={reassignTask.taskType}
          leaderRole={userRole}
          currentAgentId={reassignTask.agentId}
          isOpen={!!reassignTask}
          onClose={() => setReassignTask(null)}
          onSuccess={() => { setReassignTask(null); router.refresh(); }}
        />
      )}

      {workspaceTask && (
        <TaskWorkspaceModal
          task={workspaceTask}
          projectId={workspaceTask.projectId}
          clientName={workspaceTask.project?.deal?.lead?.name}
          contextNotes={workspaceTask.project?.globalNotes || []}
          userRole={userRole}
          onClose={() => setWorkspaceTask(null)}
          onSuccess={() => router.refresh()}
          onFlag={!isLeader && workspaceTask.agentId === userId ? () => { setFlagTask(workspaceTask); setWorkspaceTask(null); } : undefined}
        />
      )}

      {/* Self-Task Modal for Design Agents */}
      {selfTaskProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-4 border-b bg-emerald-50 flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-800">📝 Create My Task</h3>
              <button onClick={() => setSelfTaskProject(null)} className="text-slate-400 hover:text-slate-600 font-bold">&times;</button>
            </div>
            <div className="p-6">
              <SelfTaskForm projectId={selfTaskProject} userRole={userRole} onClose={() => {
                setSelfTaskProject(null);
                router.refresh();
              }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
