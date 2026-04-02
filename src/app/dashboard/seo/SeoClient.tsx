"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SeoClient({ tasks, teamMembers, designLeaders, userRole, userId }: any) {
  const router = useRouter();
  const [createSubTask, setCreateSubTask] = useState<any>(null);
  const [subTaskType, setSubTaskType] = useState("graphic_design");
  const [subTaskBrief, setSubTaskBrief] = useState("");
  const [subTaskLeader, setSubTaskLeader] = useState("");

  const isHead = ["super_admin", "head_seo"].includes(userRole);
  const isTL = userRole === "team_leader_seo";
  const isAgent = ["agent_seo", "agent_content_seo"].includes(userRole);

  const handleAssign = async (taskId: string, targetId: string) => {
    const body: any = isHead ? { leaderId: targetId } : { agentId: targetId };
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    router.refresh();
  };

  const handleCreateSubTask = async () => {
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
  };

  const handleUpdateStatus = async (taskId: string, status: string) => {
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, ...(status === "done" ? { completedAt: new Date().toISOString() } : {}) }),
    });
    router.refresh();
  };

  const statusColors: Record<string, string> = {
    pending: "bg-slate-100 text-slate-600",
    in_progress: "bg-amber-100 text-amber-700",
    review: "bg-blue-100 text-blue-700",
    done: "bg-emerald-100 text-emerald-700",
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border shadow-sm text-center"><p className="text-xs text-slate-500">Total Tasks</p><p className="text-2xl font-bold text-slate-800">{tasks.length}</p></div>
        <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 text-center"><p className="text-xs text-amber-600">In Progress</p><p className="text-2xl font-bold text-amber-700">{tasks.filter((t: any) => t.status === "in_progress").length}</p></div>
        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-center"><p className="text-xs text-blue-600">In Review</p><p className="text-2xl font-bold text-blue-700">{tasks.filter((t: any) => t.status === "review").length}</p></div>
        <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 text-center"><p className="text-xs text-emerald-600">Completed</p><p className="text-2xl font-bold text-emerald-700">{tasks.filter((t: any) => t.status === "done").length}</p></div>
      </div>

      {/* Tasks List */}
      <div className="space-y-3">
        {tasks.map((t: any) => (
          <div key={t.id} className="bg-white rounded-xl border shadow-sm p-5 hover:shadow-md transition">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-slate-900">{t.project?.deal?.lead?.name || "Unknown Client"}</h3>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[t.status] || statusColors.pending}`}>{t.status || "pending"}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${t.priority === "High" ? "bg-red-100 text-red-700" : t.priority === "Low" ? "bg-slate-100 text-slate-500" : "bg-amber-100 text-amber-600"}`}>{t.priority || "Medium"}</span>
                </div>
                <p className="text-sm text-slate-600">{t.taskType.replace(/_/g, " ")} {t.brief ? `— ${t.brief}` : ""}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                  {t.leader && <span>Leader: <strong>{t.leader.name}</strong></span>}
                  {t.agent && <span>Agent: <strong>{t.agent.name}</strong></span>}
                  {t.deadline && <span>Due: {new Date(t.deadline).toLocaleDateString()}</span>}
                  <span>Progress: <strong>{t.progressPct}%</strong></span>
                </div>
                {t.subTasks?.length > 0 && (
                  <div className="mt-2 pl-3 border-l-2 border-indigo-200 space-y-1">
                    {t.subTasks.map((st: any) => (
                      <p key={st.id} className="text-xs text-slate-500">↳ {st.taskType.replace(/_/g, " ")}: {st.status || "pending"} ({st.progressPct}%)</p>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1 ml-4">
                {/* Head/TL: Assign */}
                {(isHead || isTL) && !t.agentId && (
                  <select onChange={(e) => handleAssign(t.id, e.target.value)} className="text-xs border rounded-lg px-2 py-1.5 bg-white">
                    <option value="">Assign...</option>
                    {teamMembers.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                )}

                {/* Agent: Status actions */}
                {isAgent && (
                  <div className="flex gap-1">
                    {t.status !== "in_progress" && <button onClick={() => handleUpdateStatus(t.id, "in_progress")} className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-medium hover:bg-amber-200">Start</button>}
                    {t.status === "in_progress" && <button onClick={() => handleUpdateStatus(t.id, "review")} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium hover:bg-blue-200">Submit Review</button>}
                    {t.status === "review" && <button onClick={() => handleUpdateStatus(t.id, "done")} className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-medium hover:bg-emerald-200">Complete</button>}
                  </div>
                )}

                {/* Agent: Create Sub-Tasks */}
                {isAgent && designLeaders.length > 0 && (
                  <button onClick={() => setCreateSubTask(t)} className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs font-medium hover:bg-indigo-200 mt-1">
                    + Sub-Task
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        {tasks.length === 0 && <p className="text-sm text-slate-400 italic text-center py-8">No tasks assigned.</p>}
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
