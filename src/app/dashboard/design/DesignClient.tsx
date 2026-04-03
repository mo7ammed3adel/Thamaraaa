"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ClientJourney from "@/components/ClientJourney";

/**
 * Design & Creative department client component (Graphic, Motion, UI/UX).
 * Includes advanced filtering, status management, agent assignment,
 * and client journey notes drawer.
 */
export default function DesignClient({ tasks, agents, userRole, userId, teamLabel }: any) {
  const router = useRouter();
  const [viewClient, setViewClient] = useState<any>(null);

  // ── Advanced Filters ──
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  const isLeader = userRole.startsWith("leader_") || userRole === "super_admin";

  // ── Filter logic ──
  const filteredTasks = tasks.filter((t: any) => {
    const matchesSearch =
      !searchQuery ||
      t.project?.deal?.lead?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.brief?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.requesterRole?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || t.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || t.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  // ── Handlers ──
  async function handleAssign(taskId: string, agentId: string) {
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

  return (
    <div className="space-y-6">
      {/* Clickable KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Requests", value: tasks.length, filter: "all", cls: "bg-violet-50 border-violet-100" },
          { label: "Pending", value: tasks.filter((t: any) => t.status === "pending").length, filter: "pending", cls: "bg-slate-50 border-slate-200" },
          { label: "In Progress", value: tasks.filter((t: any) => t.status === "in_progress").length, filter: "in_progress", cls: "bg-amber-50 border-amber-100" },
          { label: "In Review", value: tasks.filter((t: any) => t.status === "review").length, filter: "review", cls: "bg-blue-50 border-blue-100" },
          { label: "Delivered", value: tasks.filter((t: any) => t.status === "done").length, filter: "done", cls: "bg-emerald-50 border-emerald-100" },
        ].map((kpi) => (
          <button key={kpi.label} onClick={() => setStatusFilter(kpi.filter)} className={`${kpi.cls} p-4 rounded-xl border text-center hover:shadow-md transition cursor-pointer ${statusFilter === kpi.filter ? "ring-2 ring-violet-500" : ""}`}>
            <p className="text-xs font-medium text-slate-600">{kpi.label}</p>
            <p className="text-2xl font-bold text-slate-800">{kpi.value}</p>
          </button>
        ))}
      </div>

      {/* Advanced Filter Bar */}
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

      <p className="text-xs text-slate-400">Showing {filteredTasks.length} of {tasks.length} requests</p>

      {/* Design Queue / Tasks */}
      <div className="space-y-3">
        {filteredTasks.map((t: any) => {
          const lead = t.project?.deal?.lead;
          return (
            <div key={t.id} className="bg-white rounded-xl border shadow-sm p-5 hover:shadow-md transition">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-bold text-slate-900">{lead?.name || "Client"}</h3>
                    {t.parentTask && (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-700">
                        From: {t.parentTask.taskType.replace(/_/g, " ")}
                      </span>
                    )}
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${t.priority === "High" ? "bg-red-100 text-red-700" : t.priority === "Low" ? "bg-slate-100 text-slate-500" : "bg-amber-100 text-amber-700"}`}>
                      {t.priority || "Medium"}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${t.status === "done" ? "bg-emerald-100 text-emerald-700" : t.status === "in_progress" ? "bg-amber-100 text-amber-700" : t.status === "review" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
                      {t.status || "pending"}
                    </span>
                  </div>
                  {t.brief && <p className="text-sm text-slate-600 mb-1">{t.brief}</p>}
                  <div className="flex gap-3 text-xs text-slate-500 flex-wrap">
                    {t.agent && <span>Assigned to: <strong>{t.agent.name}</strong></span>}
                    {t.deadline && <span>Due: {new Date(t.deadline).toLocaleDateString()}</span>}
                    {t.requesterRole && <span>Requested by: {t.requesterRole.replace(/_/g, " ")}</span>}
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
                    <div className="bg-violet-500 h-1.5 rounded-full transition-all" style={{ width: `${t.progressPct}%` }} />
                  </div>
                </div>

                <div className="flex flex-col gap-1 shrink-0">
                  {/* Leader: assign */}
                  {isLeader && !t.agentId && agents.length > 0 && (
                    <select onChange={(e) => handleAssign(t.id, e.target.value)} className="text-xs border rounded-lg px-2 py-1.5 bg-white w-28">
                      <option value="">Assign...</option>
                      {agents.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  )}
                  {/* Status actions — available for both leaders and agents */}
                  <div className="flex gap-1 flex-wrap">
                    {t.status !== "in_progress" && t.status !== "done" && t.status !== "review" && (
                      <button onClick={() => handleUpdateStatus(t.id, "in_progress")} className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-medium hover:bg-amber-200">Start</button>
                    )}
                    {t.status === "in_progress" && (
                      <button onClick={() => handleUpdateStatus(t.id, "review")} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium hover:bg-blue-200">Submit</button>
                    )}
                    {t.status === "review" && (
                      <button onClick={() => handleUpdateStatus(t.id, "done")} className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-medium hover:bg-emerald-200">Complete</button>
                    )}
                  </div>
                  {/* View Client Notes */}
                  <button onClick={() => setViewClient(t)} className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-medium hover:bg-slate-200 mt-1">
                    View Notes
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {filteredTasks.length === 0 && <p className="text-sm text-slate-400 italic text-center py-8">No design requests match your filters.</p>}
      </div>

      {/* Client Notes Modal */}
      {viewClient && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-sm">
          <div className="w-full max-w-xl bg-white h-full shadow-2xl overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-800">Client Notes</h2>
              <button onClick={() => setViewClient(null)} className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full hover:bg-slate-200 text-sm">Close ✕</button>
            </div>
            <ClientJourney
              leadName={viewClient.project?.deal?.lead?.name || "Client"}
              phone={viewClient.project?.deal?.lead?.phone}
              callLogs={viewClient.project?.deal?.lead?.callLogs}
              meetings={viewClient.project?.deal?.lead?.meetings}
              deals={[viewClient.project?.deal]}
              tasks={[viewClient]}
            />
          </div>
        </div>
      )}
    </div>
  );
}
