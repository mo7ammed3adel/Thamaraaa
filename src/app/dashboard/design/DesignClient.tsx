"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ClientJourney from "@/components/ClientJourney";

export default function DesignClient({ tasks, agents, userRole, userId, teamLabel }: any) {
  const router = useRouter();
  const [viewClient, setViewClient] = useState<any>(null);

  const isLeader = userRole.startsWith("leader_") || userRole === "super_admin";

  const handleAssign = async (taskId: string, agentId: string) => {
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId, status: "pending" }),
    });
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

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-violet-50 p-4 rounded-xl border border-violet-100 text-center"><p className="text-xs text-violet-600">Requests</p><p className="text-2xl font-bold text-violet-700">{tasks.length}</p></div>
        <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 text-center"><p className="text-xs text-amber-600">In Progress</p><p className="text-2xl font-bold text-amber-700">{tasks.filter((t: any) => t.status === "in_progress").length}</p></div>
        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-center"><p className="text-xs text-blue-600">In Review</p><p className="text-2xl font-bold text-blue-700">{tasks.filter((t: any) => t.status === "review").length}</p></div>
        <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 text-center"><p className="text-xs text-emerald-600">Delivered</p><p className="text-2xl font-bold text-emerald-700">{tasks.filter((t: any) => t.status === "done").length}</p></div>
      </div>

      {/* Design Queue / Tasks */}
      <div className="space-y-3">
        {tasks.map((t: any) => {
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
                  {/* Progress */}
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
                  {/* Agent actions */}
                  {!isLeader && (
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
                  )}
                  {/* View Client Notes */}
                  <button onClick={() => setViewClient(t)} className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-medium hover:bg-slate-200 mt-1">
                    View Notes
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {tasks.length === 0 && <p className="text-sm text-slate-400 italic text-center py-8">No design requests in queue.</p>}
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
