"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { 
  Users, AlertCircle, Clock, Calendar, CheckCircle, 
  ArrowRight, FileText, Send 
} from "lucide-react";
import Link from "next/link";
import ClientDetailModal from "@/components/ClientDetailModal";
import NotesPanel from "@/components/NotesPanel";
import CreateWarningModal from "@/components/CreateWarningModal";

export default function SocialMediaClient({
  projects, agents, designLeaders, kpis, userRole, userId, departmentTaskType
}: any) {
  const router = useRouter();
  const isTL = ["super_admin", "team_leader_social_media"].includes(userRole);
  
  const [activeTab, setActiveTab] = useState(isTL ? "incoming" : "clients");
  const [activeKpi, setActiveKpi] = useState("all");
  const [createSubTask, setCreateSubTask] = useState<any>(null);
  const [detailModal, setDetailModal] = useState<any>(null);
  const [notesPanel, setNotesPanel] = useState<any>(null);
  const [warningModal, setWarningModal] = useState<any>(null);
  
  // Sub-task form state
  const [subTaskType, setSubTaskType] = useState("graphic_design");
  const [subTaskBrief, setSubTaskBrief] = useState("");
  const [subTaskLeader, setSubTaskLeader] = useState("");
  const [subTaskDeadline, setSubTaskDeadline] = useState("");

  const incomingClients = useMemo(() => projects.filter((p: any) => p.tasks.some((t: any) => t.taskType === departmentTaskType && t.leaderId === userId && !t.agentId)), [projects, departmentTaskType, userId]);
  
  const baseAssignedProjects = useMemo(() => isTL ? projects : projects.filter((p: any) => p.tasks.some((t: any) => t.taskType === departmentTaskType && t.agentId === userId)), [isTL, projects, departmentTaskType, userId]);
  const assignedProjects = useMemo(() => {
    return baseAssignedProjects.filter((p: any) => {
      if (activeKpi === "all") return true;
      if (activeKpi === "active") return ["in_progress", "setup", "assigned"].includes(p.projectStatus);
      if (activeKpi === "pending") return p.projectStatus === "new";
      if (activeKpi === "delayed") return p.tasks?.some((t: any) => t.status !== "done" && t.deadline && new Date(t.deadline) < new Date());
      if (activeKpi === "warnings") return p.warnings && p.warnings.length > 0;
      return true;
    });
  }, [baseAssignedProjects, activeKpi]);

  const baseAllTasks = useMemo(() => projects.flatMap((p: any) => p.tasks.filter((t: any) => t.taskType === departmentTaskType || t.parentTaskId)), [projects, departmentTaskType]);
  const allTasks = useMemo(() => {
    return baseAllTasks.filter((t: any) => {
      if (activeKpi === "all") return true;
      if (activeKpi === "active") return ["in_progress", "review"].includes(t.status);
      if (activeKpi === "pending") return t.status === "pending";
      if (activeKpi === "delayed") return t.status !== "done" && t.deadline && new Date(t.deadline) < new Date();
      return true;
    });
  }, [baseAllTasks, activeKpi]);

  async function handleAssignAgent(taskId: string, targetAgentId: string) {
    if (!targetAgentId) return;
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId: targetAgentId }),
    });
    router.refresh();
  }

  async function handleCreateSubTask() {
    if (!createSubTask || !subTaskLeader) return;
    await fetch("/api/tasks/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: createSubTask.id,
        packageType: subTaskType,
        parentTaskId: createSubTask.tasks.find((t: any) => t.taskType === departmentTaskType)?.id,
        brief: subTaskBrief,
        deadline: subTaskDeadline || undefined,
        graphicLeaderId: subTaskType === "graphic_design" ? subTaskLeader : undefined,
        motionLeaderId: subTaskType === "motion_graphic" ? subTaskLeader : undefined,
        uiLeaderId: subTaskType === "ui_design" ? subTaskLeader : undefined,
      }),
    });
    setCreateSubTask(null);
    setSubTaskBrief("");
    router.refresh();
  }

  async function handleUpdateTask(taskId: string, status: string) {
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, ...(status === "done" ? { completedAt: new Date().toISOString() } : {}) }),
    });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* KPI Overview */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { id: "all", icon: Users, label: "Total Clients", val: kpis.totalClients, colors: "border-transparent bg-white hover:bg-gray-50", activeColors: "border-indigo-500 bg-indigo-50", defaultTab: "clients", icn: "text-indigo-500" },
          { id: "active", icon: CheckCircle, label: "Active Clients", val: kpis.activeClients, colors: "border-transparent bg-white hover:bg-gray-50", activeColors: "border-emerald-500 bg-emerald-50", defaultTab: "clients", icn: "text-emerald-500" },
          { id: "pending", icon: Calendar, label: "Pending Clients", val: kpis.pendingClients, colors: "border-transparent bg-white hover:bg-gray-50", activeColors: "border-slate-500 bg-slate-50", defaultTab: "clients", icn: "text-slate-500" },
          { id: "delayed", icon: Clock, label: "Delayed Tasks", val: kpis.delayedTasks, colors: "border-transparent bg-white hover:bg-gray-50", activeColors: "border-amber-500 bg-amber-50", defaultTab: "tasks", icn: "text-amber-500" },
          { id: "warnings", icon: AlertCircle, label: "Active Warnings", val: kpis.activeWarnings, colors: "border-transparent bg-white hover:bg-gray-50", activeColors: "border-red-500 bg-red-50", defaultTab: "clients", icn: "text-red-500" },
        ].map((k, i) => (
          <button 
            key={i} 
            onClick={() => {
              const newKpi = activeKpi === k.id ? "all" : k.id;
              setActiveKpi(newKpi);
              if (newKpi !== "all") setActiveTab(k.defaultTab);
            }}
            className={`p-4 rounded-xl border-2 transition cursor-pointer flex flex-col justify-between text-left ${activeKpi === k.id ? k.activeColors : `${k.colors} shadow-sm`}`}
          >
            <div className={`flex items-center gap-2 mb-2 ${k.icn}`}>
              <k.icon className="w-5 h-5" />
              <span className="text-[11px] font-bold uppercase tracking-wider">{k.label}</span>
            </div>
            <p className="text-2xl font-black mt-1 text-slate-900">{k.val}</p>
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {isTL && (
          <>
            <button onClick={() => setActiveTab("incoming")} className={`px-6 py-3 font-semibold text-sm border-b-2 transition ${activeTab === "incoming" ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
              📥 Incoming & Pending
            </button>
            <button onClick={() => setActiveTab("team")} className={`px-6 py-3 font-semibold text-sm border-b-2 transition ${activeTab === "team" ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
              👥 My Team
            </button>
          </>
        )}
        <button onClick={() => setActiveTab("clients")} className={`px-6 py-3 font-semibold text-sm border-b-2 transition ${activeTab === "clients" ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
             📋 {isTL ? "All Clients" : "My Clients"}
        </button>
        <button onClick={() => setActiveTab("tasks")} className={`px-6 py-3 font-semibold text-sm border-b-2 transition ${activeTab === "tasks" ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
             📝 {isTL ? "Team Tasks" : "My Tasks"}
        </button>
      </div>

      {/* INCOMING CLIENTS (TL Only) */}
      {isTL && activeTab === "incoming" && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
            <h3 className="font-bold text-gray-900">Incoming Assignments</h3>
            <span className="text-xs font-bold bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full">{incomingClients.length} Pending</span>
          </div>
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50/50 text-gray-500 font-medium">
              <tr>
                <th className="px-6 py-3">Client</th>
                <th className="px-6 py-3">Package</th>
                <th className="px-6 py-3">Received At</th>
                <th className="px-6 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {incomingClients.map((p: any) => {
                const tlTask = p.tasks.find((t: any) => t.taskType === departmentTaskType && t.leaderId === userId);
                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-bold text-gray-900">{p.deal?.lead?.name}</td>
                    <td className="px-6 py-4 text-gray-600 capitalize">{p.package.replace(/_/g, " ")}</td>
                    <td className="px-6 py-4 text-gray-500">{new Date(tlTask.createdAt).toLocaleDateString()}</td>
                    <td className="px-6 py-4">
                      <select onChange={(e) => handleAssignAgent(tlTask.id, e.target.value)} className="border-2 border-indigo-100 bg-indigo-50 text-indigo-700 font-semibold px-3 py-1.5 rounded-lg text-sm outline-none w-48">
                        <option value="">Assign to Agent...</option>
                        {agents.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </td>
                  </tr>
                );
              })}
              {incomingClients.length === 0 && (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-400 italic">No incoming clients right now!</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* MY TEAM (TL Only) */}
      {isTL && activeTab === "team" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {agents.map((agent: any) => {
            const agentProjects = projects.filter((p: any) => p.tasks.some((t: any) => t.taskType === departmentTaskType && t.agentId === agent.id));
            const agentTasks = agentProjects.flatMap((p: any) => p.tasks).filter((t: any) => t.agentId === agent.id);
            const activeT = agentTasks.filter((t: any) => t.status === "in_progress");
            const delayedT = agentTasks.filter((t: any) => t.status !== "done" && t.deadline && new Date(t.deadline) < new Date());
            
            return (
              <div key={agent.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 hover:shadow-md transition cursor-pointer">
                <div className="flex items-center gap-4 mb-4">
                  <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center text-xl font-bold text-indigo-700">
                    {agent.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{agent.name}</h3>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest text-[10px]">Social Media Agent</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Active Clients</span>
                    <span className="font-bold text-gray-900">{agentProjects.length}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">In-progress Tasks</span>
                    <span className="font-bold text-amber-600">{activeT.length}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Delayed Tasks</span>
                    <span className={`font-bold ${delayedT.length > 0 ? "text-red-600" : "text-emerald-500"}`}>{delayedT.length}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CLIENTS LIST */}
      {activeTab === "clients" && (
        <div className="space-y-4">
          {assignedProjects.map((p: any) => {
            const hasWarning = p.warnings?.some((w: any) => w.status === "Active" || !w.acknowledgedBy?.includes(userId));
            const activeTask = p.tasks.find((t: any) => t.taskType === departmentTaskType && (t.agentId === userId || t.leaderId === userId));
            
            return (
              <div key={p.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 hover:shadow-lg transition">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-lg font-bold text-gray-900">{p.deal?.lead?.name}</h3>
                      <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${p.projectStatus === "completed" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-100 text-gray-600 border-gray-200"}`}>
                        {p.projectStatus.replace(/_/g, " ")}
                      </span>
                      {hasWarning && <span className="flex items-center gap-1 bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded text-[10px] uppercase font-bold"><AlertCircle className="w-3 h-3" /> Warning</span>}
                    </div>
                    
                    <div className="flex items-center gap-4 text-xs text-gray-500 mt-2">
                      <span className="px-2 py-1 bg-gray-50 rounded-md font-medium text-gray-700">💼 {p.package.replace(/_/g, " ")}</span>
                      {isTL && activeTask?.agent && <span>Agent: <strong className="text-gray-800">{activeTask.agent.name}</strong></span>}
                      <span>Progress: <strong className="text-gray-800">{departmentTaskType === "media_buying" ? p.mediaBuyerProgress : p.socialMediaProgress}%</strong></span>
                    </div>
                  </div>
                  
                  <div className="flex flex-col md:flex-row gap-2 shrink-0">
                    <button onClick={() => setDetailModal(p)} className="px-4 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl text-sm font-bold hover:bg-indigo-100 shadow-sm transition">
                       Details
                    </button>
                    <button onClick={() => setNotesPanel(p)} className="px-4 py-2 bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-sm font-bold hover:bg-slate-100 shadow-sm transition">
                       Notes
                    </button>
                    <Link href={`/dashboard/clients/${p.id}`} className="px-4 py-2 bg-gray-50 text-gray-700 border border-gray-200 rounded-xl text-sm font-bold hover:bg-gray-100 shadow-sm transition flex items-center justify-center gap-2">
                       Full Journey <ArrowRight className="w-4 h-4" />
                    </Link>
                    {(!isTL || (activeTask && activeTask.leaderId === userId)) && (
                      <button onClick={() => setCreateSubTask(p)} className="px-4 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl text-sm font-bold hover:bg-indigo-100 shadow-sm transition flex items-center justify-center gap-2">
                        + Sub-Task (Design)
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {assignedProjects.length === 0 && (
            <div className="border border-dashed border-gray-300 bg-gray-50 rounded-2xl p-12 text-center text-gray-500 italic">No assigned clients.</div>
          )}
        </div>
      )}

      {/* TASKS */}
      {activeTab === "tasks" && (
        <div className="space-y-4">
           {allTasks.map((t: any) => {
             const clientName = t.project?.deal?.lead?.name || "Unknown";
             
             return (
               <div key={t.id} className="bg-white rounded-xl border p-5 shadow-sm">
                  <div className="flex justify-between items-start">
                    <div>
                       <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-gray-900">{clientName}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] bg-gray-100 text-gray-600 uppercase font-bold">{t.taskType.replace(/_/g, " ")}</span>
                       </div>
                       <p className="text-sm text-gray-600 mb-3">{t.brief || "No brief attached"}</p>
                       <div className="flex gap-4 text-xs font-medium text-gray-500">
                          {t.deadline && <span>Deadline: {new Date(t.deadline).toLocaleDateString()}</span>}
                          <span>Status: <strong className={t.status === "done" ? "text-emerald-600" : "text-amber-600"}>{t.status}</strong></span>
                          <span>Progress: {t.progressPct}%</span>
                       </div>
                    </div>
                    {/* Status Updaters for Assigned Agent */}
                    {(t.agentId === userId || t.leaderId === userId || t.requesterRole === userRole) && (
                      <div className="flex gap-2">
                        {t.status === "pending" && <button onClick={() => handleUpdateTask(t.id, "in_progress")} className="px-3 py-1 bg-amber-100 text-amber-700 rounded-lg text-xs font-bold">Start</button>}
                        {t.status === "in_progress" && <button onClick={() => handleUpdateTask(t.id, "review")} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-bold">Submit Review</button>}
                        {t.status === "review" && <button onClick={() => handleUpdateTask(t.id, "done")} className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold">Done</button>}
                      </div>
                    )}
                  </div>
               </div>
             )
           })}
           {allTasks.length === 0 && <div className="border border-dashed border-gray-300 bg-gray-50 rounded-2xl p-12 text-center text-gray-500 italic">No tasks found.</div>}
        </div>
      )}

      {/* CREATE SUB-TASK MODAL */}
      {createSubTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden">
            <div className="px-6 py-4 bg-indigo-50 border-b border-indigo-100 flex items-center gap-3">
               <Send className="w-5 h-5 text-indigo-600" />
               <div>
                  <h3 className="font-bold text-indigo-900">Request Design Asset</h3>
                  <p className="text-xs text-indigo-600 font-medium">For: {createSubTask.deal?.lead?.name}</p>
               </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Target Department</label>
                <select value={subTaskType} onChange={(e) => setSubTaskType(e.target.value)} className="w-full border rounded-xl px-4 py-2 text-sm bg-gray-50">
                  <option value="graphic_design">Graphic Design</option>
                  <option value="motion_graphic">Motion Graphics</option>
                  <option value="ui_design">UI/UX Design</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Creative Brief / Requirements</label>
                <textarea value={subTaskBrief} onChange={(e) => setSubTaskBrief(e.target.value)} className="w-full border rounded-xl px-4 py-3 text-sm h-32 resize-none bg-gray-50" placeholder="Type instructions, sizes, references..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="text-xs font-bold text-gray-700 block mb-1">Target Deadline</label>
                   <input type="date" value={subTaskDeadline} onChange={(e) => setSubTaskDeadline(e.target.value)} className="w-full border rounded-xl px-4 py-2 text-sm bg-gray-50" />
                 </div>
                 <div>
                   <label className="text-xs font-bold text-gray-700 block mb-1">Assign to Leader</label>
                   <select value={subTaskLeader} onChange={(e) => setSubTaskLeader(e.target.value)} className="w-full border rounded-xl px-4 py-2 text-sm bg-gray-50">
                     <option value="">Select Design Leader...</option>
                     {designLeaders
                       .filter((d: any) => {
                         if (subTaskType === "graphic_design") return d.role === "leader_graphic_designer";
                         if (subTaskType === "motion_graphic") return d.role === "leader_motion_graphic";
                         if (subTaskType === "ui_design") return d.role === "leader_ui";
                         return false;
                       })
                       .map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)
                     }
                   </select>
                 </div>
              </div>
              <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
                <button onClick={() => setCreateSubTask(null)} className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-200">Cancel</button>
                <button onClick={handleCreateSubTask} disabled={!subTaskLeader || !subTaskBrief} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50">Send Request</button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* MODALS */}
      {detailModal && <ClientDetailModal isOpen={!!detailModal} currentUserRole={userRole} project={detailModal} onClose={() => setDetailModal(null)} />}
      {notesPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden relative">
            <button onClick={() => setNotesPanel(null)} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 z-10 transition">✕ Close</button>
            <NotesPanel projectId={notesPanel.id} currentUserRole={userRole} />
          </div>
        </div>
      )}
      {warningModal && <CreateWarningModal isOpen={!!warningModal} projectId={warningModal.id} clientId={warningModal.deal?.leadId} onClose={() => setWarningModal(null)} />}
    </div>
  );
}
