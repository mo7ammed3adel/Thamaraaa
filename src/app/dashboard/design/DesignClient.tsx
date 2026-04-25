"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Inbox, Clock, CheckCircle, AlertTriangle, Users, ExternalLink
} from "lucide-react";
import TaskFlagModal from "@/components/TaskFlagModal";
import TaskReassignModal from "@/components/TaskReassignModal";

/**
 * Design & Creative department client component (Graphic, Motion, UI/UX).
 * Full-spec implementation with Leader tabs (Incoming, My Team, All Tasks)
 * and Agent-focused task execution view.
 */
export default function DesignClient({ tasks, agents, userRole, userId, teamLabel }: any) {
  const router = useRouter();
  const isLeader = userRole.startsWith("leader_") || userRole === "super_admin";
  const [activeTab, setActiveTab] = useState(isLeader ? "incoming" : "tasks");
  const [activeKpi, setActiveKpi] = useState("all");
  const [flagTask, setFlagTask] = useState<any>(null);
  const [reassignTask, setReassignTask] = useState<any>(null);

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
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId, status: "pending" }),
    });
    router.refresh();
  }

  async function handleUpdateStatus(taskId: string, status: string) {
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, ...(status === "done" ? { completedAt: new Date().toISOString() } : {}) }),
    });
    router.refresh();
  }

  async function handleUpdateFiles(taskId: string, filesString: string) {
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ files: filesString }),
    });
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
              {t.parentTask && (
                <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  From: {t.parentTask.taskType.replace(/_/g, " ")}
                </span>
              )}
            </div>
            {t.brief && <p className="text-sm text-gray-600 mt-1">{t.brief}</p>}
          </div>
          {t.deadline && (
            <div className="text-right shrink-0">
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
          <div className="w-full md:w-64 space-y-3 border-t md:border-t-0 md:border-l border-gray-100 pt-4 md:pt-0 md:pl-6 shrink-0 flex flex-col justify-center">
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

            {/* Status Actions */}
            <div className="grid grid-cols-1 gap-2 border-t pt-2 border-gray-100">
              <p className="text-xs font-bold text-gray-700 mb-1">Deliverables</p>
              <textarea 
                placeholder="Links to final files (Drive, Figma, etc)"
                className="w-full border rounded-lg px-2 py-1 text-xs outline-none focus:border-violet-500 bg-gray-50 h-16"
                defaultValue={t.files || ""}
                onBlur={(e) => {
                  if (e.target.value !== t.files) {
                    handleUpdateFiles(t.id, e.target.value);
                  }
                }}
              />
            </div>

            <div className="grid grid-cols-1 gap-2 pt-2">
              {t.status !== "in_progress" && t.status !== "done" && t.status !== "review" && (
                <button onClick={() => handleUpdateStatus(t.id, "in_progress")} className="w-full py-2 bg-gray-800 text-white rounded-xl text-sm font-bold hover:bg-gray-900 shadow-sm transition">Start Task</button>
              )}
              {t.status === "in_progress" && (
                <button onClick={() => handleUpdateStatus(t.id, "review")} className="w-full py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 shadow-sm transition">Submit for Review</button>
              )}
              {t.status === "review" && (
                <button onClick={() => handleUpdateStatus(t.id, "done")} className="w-full py-2 bg-emerald-500 text-white rounded-xl text-sm font-bold hover:bg-emerald-600 shadow-sm transition">Mark Delivered</button>
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
            className={`p-4 rounded-xl border-2 transition text-left flex flex-col justify-between ${k.disableFilter ? "cursor-default shadow-sm" : "cursor-pointer"} ${activeKpi === k.id ? k.activeColors : `${k.colors} ${k.disableFilter ? "" : "shadow-sm"}`}`}
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
          </div>

          <p className="text-xs text-gray-400">Showing {filteredTasks.length} of {tasks.length} requests</p>

          {filteredTasks.map((t: any) => <TaskCard key={t.id} t={t} showAssign={isLeader} />)}
          {filteredTasks.length === 0 && (
            <div className="bg-gray-50 border border-dashed border-gray-300 rounded-2xl p-12 text-center text-gray-500">No design requests match your filters.</div>
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
          leaderRole={userRole}
          currentAgentId={reassignTask.agentId}
          isOpen={!!reassignTask}
          onClose={() => setReassignTask(null)}
          onSuccess={() => { setReassignTask(null); router.refresh(); }}
        />
      )}
    </div>
  );
}
