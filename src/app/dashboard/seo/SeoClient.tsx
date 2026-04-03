"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * SEO Department client component with advanced filtering,
 * task assignment, status management, and sub-task creation.
 */
export default function SeoClient({ tasks, teamMembers, designLeaders, userRole, userId }: any) {
  const router = useRouter();
  const [createSubTask, setCreateSubTask] = useState<any>(null);
  const [subTaskType, setSubTaskType] = useState("graphic_design");
  const [subTaskBrief, setSubTaskBrief] = useState("");
  const [subTaskLeader, setSubTaskLeader] = useState("");

  // ── Advanced Filters ──
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  const isHead = ["super_admin", "head_seo"].includes(userRole);
  const isTL = userRole === "team_leader_seo";
  const isAgent = ["agent_seo", "agent_content_seo"].includes(userRole);

  // ── Filter logic ──
  const filteredTasks = tasks.filter((t: any) => {
    const matchesSearch =
      !searchQuery ||
      t.project?.deal?.lead?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.taskType?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.brief?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || t.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || t.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  // ── Handlers ──
  async function handleAssign(taskId: string, targetId: string) {
    const body: any = isHead ? { leaderId: targetId } : { agentId: targetId };
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    router.refresh();
  }

  async function handleCreateSubTask() {
    if (!createSubTask || !subTaskLeader) return;
    await fetch("/api/tasks/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: createSubTask.projectId,
        packageType: subTaskType,
        parentTaskId: createSubTask.id,
        brief: subTaskBrief,
        seoLeaderId: subTaskType === "ui_design" ? undefined : subTaskLeader,
        socialLeaderId: undefined,
        graphicLeaderId: subTaskType === "graphic_design" ? subTaskLeader : undefined,
        uiLeaderId: subTaskType === "ui_design" ? subTaskLeader : undefined,
      }),
    });
    setCreateSubTask(null);
    setSubTaskBrief("");
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

  const statusColors: Record<string, string> = {
    pending: "bg-slate-100 text-slate-600",
    in_progress: "bg-amber-100 text-amber-700",
    review: "bg-blue-100 text-blue-700",
    done: "bg-emerald-100 text-emerald-700",
  };

  return (
    <div className="space-y-6">
      {/* Stats — Clickable KPI cards set the status filter */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Total Tasks", value: tasks.length, filter: "all", cls: "bg-white border" },
          { label: "Pending", value: tasks.filter((t: any) => t.status === "pending").length, filter: "pending", cls: "bg-slate-50 border-slate-200" },
          { label: "In Progress", value: tasks.filter((t: any) => t.status === "in_progress").length, filter: "in_progress", cls: "bg-amber-50 border-amber-100" },
          { label: "In Review", value: tasks.filter((t: any) => t.status === "review").length, filter: "review", cls: "bg-blue-50 border-blue-100" },
          { label: "Completed", value: tasks.filter((t: any) => t.status === "done").length, filter: "done", cls: "bg-emerald-50 border-emerald-100" },
        ].map((kpi) => (
          <button key={kpi.label} onClick={() => setStatusFilter(kpi.filter)} className={`${kpi.cls} p-4 rounded-xl border text-center hover:shadow-md transition cursor-pointer ${statusFilter === kpi.filter ? "ring-2 ring-indigo-500" : ""}`}>
            <p className="text-xs font-medium text-slate-500">{kpi.label}</p>
            <p className="text-2xl font-bold text-slate-800">{kpi.value}</p>
          </button>
        ))}
      </div>

      {/* Advanced Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl border p-4 shadow-sm">
        <input
          type="text"
          placeholder="🔍 Search client, task type, brief..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 min-w-[200px] border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none">
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="review">Review</option>
          <option value="done">Done</option>
        </select>
        <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none">
          <option value="all">All Priorities</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
        {(searchQuery || statusFilter !== "all" || priorityFilter !== "all") && (
          <button onClick={() => { setSearchQuery(""); setStatusFilter("all"); setPriorityFilter("all"); }} className="px-3 py-2 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition">
            ✕ Clear
          </button>
        )}
      </div>

      <p className="text-xs text-slate-400">Showing {filteredTasks.length} of {tasks.length} tasks</p>

      {/* Tasks List */}
      <div className="space-y-3">
        {filteredTasks.map((t: any) => (
          <div key={t.id} className="bg-white rounded-xl border shadow-sm p-5 hover:shadow-md transition">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="font-bold text-slate-900">{t.project?.deal?.lead?.name || "Unknown Client"}</h3>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[t.status] || statusColors.pending}`}>{t.status || "pending"}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${t.priority === "High" ? "bg-red-100 text-red-700" : t.priority === "Low" ? "bg-slate-100 text-slate-500" : "bg-amber-100 text-amber-600"}`}>{t.priority || "Medium"}</span>
                </div>
                <p className="text-sm text-slate-600 capitalize">{t.taskType.replace(/_/g, " ")} {t.brief ? `— ${t.brief}` : ""}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 flex-wrap">
                  {t.leader && <span>Leader: <strong>{t.leader.name}</strong></span>}
                  {t.agent && <span>Agent: <strong>{t.agent.name}</strong></span>}
                  {t.deadline && <span>Due: {new Date(t.deadline).toLocaleDateString()}</span>}
                  <span>Progress: <strong>{t.progressPct}%</strong></span>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2"><div className="bg-indigo-500 h-1.5 rounded-full transition-all" style={{ width: `${t.progressPct}%` }} /></div>
                {t.subTasks?.length > 0 && (
                  <div className="mt-2 pl-3 border-l-2 border-indigo-200 space-y-1">
                    {t.subTasks.map((st: any) => (
                      <p key={st.id} className="text-xs text-slate-500">↳ {st.taskType.replace(/_/g, " ")}: {st.status || "pending"} ({st.progressPct}%)</p>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1 ml-4 shrink-0">
                {/* Head/TL: Assign */}
                {(isHead || isTL) && !t.agentId && (
                  <select onChange={(e) => handleAssign(t.id, e.target.value)} className="text-xs border rounded-lg px-2 py-1.5 bg-white w-32">
                    <option value="">Assign...</option>
                    {teamMembers.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                )}
                {/* Status actions */}
                {(isAgent || isHead || isTL) && (
                  <div className="flex gap-1 flex-wrap">
                    {t.status !== "in_progress" && t.status !== "done" && t.status !== "review" && (
                      <button onClick={() => handleUpdateStatus(t.id, "in_progress")} className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-medium hover:bg-amber-200">Start</button>
                    )}
                    {t.status === "in_progress" && (
                      <button onClick={() => handleUpdateStatus(t.id, "review")} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium hover:bg-blue-200">Submit Review</button>
                    )}
                    {t.status === "review" && (
                      <button onClick={() => handleUpdateStatus(t.id, "done")} className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-medium hover:bg-emerald-200">Complete</button>
                    )}
                  </div>
                )}
                {/* Create Sub-Tasks */}
                {designLeaders.length > 0 && (
                  <button onClick={() => setCreateSubTask(t)} className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs font-medium hover:bg-indigo-200 mt-1">+ Sub-Task</button>
                )}
              </div>
            </div>
          </div>
        ))}
        {filteredTasks.length === 0 && <p className="text-sm text-slate-400 italic text-center py-8">No tasks match your filters.</p>}
      </div>

      {/* Create Sub-Task Modal */}
      {createSubTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Create Sub-Task</h3>
            <p className="text-sm text-slate-500 mb-4">For: {createSubTask.project?.deal?.lead?.name}</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Task Type</label>
                <select value={subTaskType} onChange={(e) => setSubTaskType(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="graphic_design">Graphic Design</option>
                  <option value="ui_design">UI/UX Design</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Brief</label>
                <textarea value={subTaskBrief} onChange={(e) => setSubTaskBrief(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm h-20 resize-none" placeholder="Describe what you need..." />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Assign to Leader</label>
                <select value={subTaskLeader} onChange={(e) => setSubTaskLeader(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="">Select leader...</option>
                  {designLeaders.filter((d: any) => subTaskType === "graphic_design" ? d.role === "leader_graphic_designer" : d.role === "leader_ui").map((d: any) => (
                    <option key={d.id} value={d.id}>{d.name} ({d.role.replace(/_/g, " ")})</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setCreateSubTask(null)} className="flex-1 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200">Cancel</button>
              <button onClick={handleCreateSubTask} disabled={!subTaskLeader} className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
