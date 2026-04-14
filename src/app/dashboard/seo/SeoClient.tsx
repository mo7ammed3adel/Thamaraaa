"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import ClientDetailModal from "@/components/ClientDetailModal";
import NotesPanel from "@/components/NotesPanel";
import CreateWarningModal from "@/components/CreateWarningModal";

/**
 * SEO Department client component with advanced filtering,
 * task assignment, status management, and sub-task creation.
 */
export default function SeoClient({ tasks, teamMembers, designLeaders, userRole, userId }: any) {
  const router = useRouter();
  const [createSubTask, setCreateSubTask] = useState<any>(null);
  const [detailModal, setDetailModal] = useState<any>(null);
  const [notesPanel, setNotesPanel] = useState<any>(null);
  const [warningModal, setWarningModal] = useState<any>(null);

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
  const filteredTasks = useMemo(() => {
    return tasks.filter((t: any) => {
      const matchesSearch =
        !searchQuery ||
        t.project?.deal?.lead?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.taskType?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.brief?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || t.status === statusFilter;
      const matchesPriority = priorityFilter === "all" || t.priority === priorityFilter;
      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [tasks, searchQuery, statusFilter, priorityFilter]);

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
          { label: "Total Tasks", value: tasks.length, filter: "all", colors: "bg-white border-slate-200 text-slate-800" },
          { label: "Pending", value: tasks.filter((t: any) => t.status === "pending").length, filter: "pending", colors: "bg-slate-50 border-slate-200 text-slate-600" },
          { label: "In Progress", value: tasks.filter((t: any) => t.status === "in_progress").length, filter: "in_progress", colors: "bg-amber-50 border-amber-200 text-amber-900" },
          { label: "In Review", value: tasks.filter((t: any) => t.status === "review").length, filter: "review", colors: "bg-blue-50 border-blue-200 text-blue-900" },
          { label: "Completed", value: tasks.filter((t: any) => t.status === "done").length, filter: "done", colors: "bg-emerald-50 border-emerald-200 text-emerald-900" },
        ].map(kpi => (
          <button 
            key={kpi.label} 
            onClick={() => setStatusFilter(kpi.filter)} 
            className={`p-5 rounded-2xl border text-left hover:shadow-md transition cursor-pointer ${kpi.colors} ${statusFilter === kpi.filter ? "ring-2 ring-indigo-500 shadow-sm" : "opacity-80 hover:opacity-100"}`}
          >
            <p className="text-xs font-bold uppercase tracking-wider">{kpi.label}</p>
            <p className="text-3xl font-black mt-2">{kpi.value}</p>
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
      <div className="space-y-4">
        {filteredTasks.map((t: any) => {
          const isDelayed = t.status !== "done" && t.deadline && new Date(t.deadline) < new Date();
          
          return (
            <div key={t.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition">
              {/* Header */}
              <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="text-lg font-bold text-slate-900">{t.project?.deal?.lead?.name || "Unknown Client"}</h3>
                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${t.status === "done" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : isDelayed ? "bg-red-50 text-red-700 border-red-200" : t.status === "in_progress" ? "bg-amber-50 text-amber-700 border-amber-200" : t.status === "review" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-slate-100 text-slate-600 border-slate-200"}`}>
                      {isDelayed ? "DELAYED" : t.status.replace(/_/g, " ")}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${t.priority === "High" ? "bg-red-50 text-red-700 border-red-200" : "bg-slate-50 text-slate-600 border-slate-200"}`}>{t.priority || "Medium"} Priority</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                     <span className="font-bold text-[10px] uppercase bg-indigo-100 px-2 py-0.5 rounded text-indigo-800">{t.taskType.replace(/_/g, " ")}</span>
                     <span className="text-sm text-slate-600">{t.brief ? t.brief : "No specific brief provided"}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <button onClick={() => setDetailModal(t.project)} className="border px-2 py-1 text-[10px] uppercase font-bold rounded hover:bg-slate-50 transition">Details</button>
                    <button onClick={() => setNotesPanel(t.project)} className="border px-2 py-1 text-[10px] uppercase font-bold rounded hover:bg-slate-50 transition">Notes</button>
                  </div>
                </div>
                {t.deadline && (
                  <div className="text-right">
                    <p className="text-xs text-slate-500 font-medium">Deadline</p>
                    <p className={`text-sm font-bold ${isDelayed ? "text-red-600" : "text-slate-800"}`}>{new Date(t.deadline).toLocaleDateString()}</p>
                  </div>
                )}
              </div>

              {/* Body */}
              <div className="px-6 py-5 flex flex-col md:flex-row gap-6">
                <div className="flex-1 space-y-4">
                  <div className="flex gap-8">
                     <div>
                       <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Team Leader</p>
                       <p className="text-sm font-semibold text-slate-800">{t.leader?.name || <span className="text-slate-400 italic">Not Assigned</span>}</p>
                     </div>
                     <div>
                       <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Assigned Agent</p>
                       <p className="text-sm font-semibold text-slate-800">{t.agent?.name || <span className="text-slate-400 italic">Not Assigned</span>}</p>
                     </div>
                  </div>
                  
                  {/* Progress Bar */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-bold text-slate-600">Task Progress</span>
                      <span className="font-bold text-indigo-600">{t.progressPct}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                       <div className="bg-indigo-500 h-2 rounded-full transition-all duration-500" style={{ width: `${t.progressPct}%` }} />
                    </div>
                  </div>

                  {t.subTasks?.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                      <p className="text-xs font-bold text-slate-700 uppercase">Sub-Tasks</p>
                      {t.subTasks.map((st: any) => (
                        <div key={st.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 border">
                           <span className="text-xs font-bold text-slate-700 capitalize">{st.taskType.replace(/_/g, " ")}</span>
                           <span className={`text-[10px] font-bold uppercase ${st.status === "done" ? "text-emerald-600" : "text-amber-600"}`}>{st.status || "pending"} ({st.progressPct}%)</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions Sidebar */}
                <div className="w-full md:w-64 space-y-3 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6 shrink-0 flex flex-col justify-center">
                  {(isHead || isTL) && !t.agentId && (
                    <div>
                       <p className="text-xs font-bold text-slate-700 mb-1">{isHead ? "Assign Team Leader" : "Assign To Agent"}</p>
                       <select onChange={(e) => handleAssign(t.id, e.target.value)} className="text-sm border-2 border-indigo-100 rounded-xl px-3 py-2 text-indigo-800 font-medium bg-indigo-50 w-full outline-none focus:border-indigo-500 transition">
                         <option value="">{isHead ? "Select Team Leader..." : "Select an agent..."}</option>
                         {teamMembers.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
                       </select>
                    </div>
                  )}
                  
                  {(isAgent || isHead || isTL) && (
                     <div className="grid grid-cols-1 gap-2">
                        {t.status !== "in_progress" && t.status !== "done" && t.status !== "review" && (
                          <button onClick={() => handleUpdateStatus(t.id, "in_progress")} className="w-full py-2 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-900 shadow-sm transition">Start Task</button>
                        )}
                        {t.status === "in_progress" && (
                          <button onClick={() => handleUpdateStatus(t.id, "review")} className="w-full py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 shadow-sm transition">Submit for Review</button>
                        )}
                        {t.status === "review" && (
                          <button onClick={() => handleUpdateStatus(t.id, "done")} className="w-full py-2 bg-emerald-500 text-white rounded-xl text-sm font-bold hover:bg-emerald-600 shadow-sm transition">Mark Completed</button>
                        )}
                     </div>
                  )}

                  {designLeaders.length > 0 && (
                    <button onClick={() => setCreateSubTask(t)} className="w-full py-2 bg-purple-50 text-purple-700 border border-purple-200 rounded-xl text-sm font-bold hover:bg-purple-100 transition mt-2">
                       + Request Design
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {filteredTasks.length === 0 && (
          <div className="bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-12 text-center">
            <p className="text-slate-500 font-medium">No tasks match your filters.</p>
          </div>
        )}
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

      {/* MODALS */}
      {detailModal && <ClientDetailModal isOpen={!!detailModal} currentUserRole={userRole} project={detailModal} onClose={() => setDetailModal(null)} />}
      {notesPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden relative">
            <button onClick={() => setNotesPanel(null)} className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 z-10 transition">✕ Close</button>
            <NotesPanel projectId={notesPanel.id} currentUserRole={userRole} />
          </div>
        </div>
      )}
      {warningModal && <CreateWarningModal isOpen={!!warningModal} projectId={warningModal.id} clientId={warningModal.deal?.leadId} onClose={() => setWarningModal(null)} />}
    </div>
  );
}
