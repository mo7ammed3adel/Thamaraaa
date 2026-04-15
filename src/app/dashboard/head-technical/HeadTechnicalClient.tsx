"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";

export default function HeadTechnicalClient({ projects, teamLeaders, kpis, userId }: any) {
  const router = useRouter();
  const [assignModal, setAssignModal] = useState<any>(null);
  const [taskFilter, setTaskFilter] = useState("all");
  const [activeKpi, setActiveKpi] = useState("all");

  const filteredProjects = useMemo(() => {
    return projects.filter((p: any) => {
      if (activeKpi === "assigned") return p.accountManagerId || p.tasks?.some((t: any) => ["social_media", "media_buying", "seo", "content_seo"].includes(t.taskType) && t.leaderId);
      if (activeKpi === "active") return ["in_progress", "setup", "assigned"].includes(p.projectStatus);
      if (activeKpi === "delayed") return p.projectStatus === "delayed";
      if (activeKpi === "in_progress") return p.tasks?.some((t: any) => t.status === "in_progress");
      return true;
    });
  }, [projects, activeKpi]);

  const getProgressColor = (val: number) => val < 30 ? "bg-red-500" : val < 70 ? "bg-amber-400" : "bg-emerald-500";

  const handleAssignToTeamLeader = async (projectId: string, leaderId: string, taskType: string) => {
    if (taskType === "head_seo") {
      await fetch(`/api/projects/${projectId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetRole: "head_seo", assigneeId: leaderId }),
      });
      // Also generate SEO general task
      await fetch("/api/tasks/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          packageType: "seo",
          seoLeaderId: leaderId,
        }),
      });
    } else {
      await fetch("/api/tasks/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          packageType: taskType,
          socialLeaderId: taskType === "social_media" ? leaderId : undefined,
          mediaLeaderId: taskType === "media_buying" ? leaderId : undefined,
        }),
      });
    }
    setAssignModal(null);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { id: "all", label: "My Total Projects", val: kpis.assignedClients + kpis.activeClients + kpis.delayedClients, colors: "border-transparent bg-white hover:bg-gray-50", activeColors: "border-slate-500 bg-slate-50", icnColor: "text-slate-500" },
          { id: "assigned", label: "Assigned Clients", val: kpis.assignedClients, colors: "border-transparent bg-white hover:bg-gray-50", activeColors: "border-blue-500 bg-blue-50", icnColor: "text-blue-500" },
          { id: "active", label: "Active Clients", val: kpis.activeClients, colors: "border-transparent bg-white hover:bg-gray-50", activeColors: "border-indigo-500 bg-indigo-50", icnColor: "text-indigo-500" },
          { id: "delayed", label: "Delayed Clients", val: kpis.delayedClients, colors: "border-transparent bg-white hover:bg-gray-50", activeColors: "border-red-500 bg-red-50", icnColor: "text-red-500" },
          { id: "in_progress", label: "Tasks In Progress", val: kpis.tasksInProgress, colors: "border-transparent bg-white hover:bg-gray-50", activeColors: "border-amber-500 bg-amber-50", icnColor: "text-amber-500" }
        ].map(k => (
          <button 
            key={k.label} 
            onClick={() => setActiveKpi(activeKpi === k.id ? "all" : k.id)}
            className={`p-4 flex flex-col justify-between rounded-xl border-2 text-left transition cursor-pointer ${activeKpi === k.id ? k.activeColors : `${k.colors} shadow-sm`}`}
          >
            <div className={`flex items-center gap-2 mb-2 ${k.icnColor}`}>
              <span className="text-[11px] font-bold uppercase tracking-wider">{k.label}</span>
            </div>
            <p className="text-2xl font-black mt-1 text-slate-900">{k.val}</p>
          </button>
        ))}
      </div>

      {/* Projects Table */}
      <div className="bg-white rounded-xl shadow border overflow-hidden">
        <div className="p-4 border-b bg-slate-50">
          <h2 className="text-lg font-bold text-slate-800">Master Clients List</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase w-1/4">Client Name</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase w-1/4">Assigned Teams</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase w-1/4">Progress %</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase w-32">Status & Delays</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredProjects.map((p: any) => {
                const delayedTasks = p.tasks?.filter((t:any) => t.status !== "done" && t.deadline && new Date(t.deadline) < new Date()).length || 0;
                
                return (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900">{p.deal?.lead?.name}</div>
                      <div className="text-xs text-slate-500">{p.deal?.lead?.phone}</div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-100 text-purple-800 inline-block mt-1">{p.package}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs space-y-1">
                        {p.tasks?.filter((t:any) => ["social_media", "media_buying", "seo", "content_seo"].includes(t.taskType)).map((t:any) => (
                          <div key={t.id} className="flex flex-col bg-slate-50 border rounded p-1.5">
                            <span className="font-bold text-slate-700 uppercase" style={{fontSize: "10px"}}>{t.taskType.replace(/_/g, " ")}</span>
                            <span className="text-slate-500">{t.leader?.name || "Pending..."}</span>
                          </div>
                        ))}
                        {(!p.tasks || p.tasks.filter((t:any) => ["social_media", "media_buying", "seo", "content_seo"].includes(t.taskType)).length === 0) && (
                          <span className="text-slate-400 italic">No operational teams assigned</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="w-full space-y-1 max-w-xs">
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
                      <div className="flex flex-col items-center gap-1">
                        <span className={`px-2 py-0.5 text-[10px] rounded font-bold uppercase border ${p.projectStatus === "completed" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : p.projectStatus === "delayed" ? "bg-red-50 text-red-700 border-red-200" : p.projectStatus === "in_progress" ? "bg-blue-50 text-blue-700 border-blue-200" : p.projectStatus === "new" ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-slate-50 text-slate-700 border-slate-200"}`}>
                          {p.projectStatus.replace(/_/g, " ")}
                        </span>
                        {delayedTasks > 0 && <span className="text-[10px] text-red-600 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded font-bold">{delayedTasks} Delayed</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex flex-col items-end gap-2">
                        <button onClick={() => setAssignModal(p)} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 shadow-sm transition w-28 text-center">
                          Assign Teams
                        </button>
                        <button onClick={() => router.push(`/dashboard/clients/${p.id}`)} className="px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-slate-900 shadow-sm transition w-28 text-center">
                          Full Journey →
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredProjects.length === 0 && (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-sm text-slate-400 italic">No clients available.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assign Modal */}
      {assignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Assign Team for: {assignModal.deal?.lead?.name}</h3>
            <p className="text-sm text-slate-500 mb-4">Select a team leader to assign this project to:</p>
            <div className="space-y-2">
              {teamLeaders.map((tl: any) => {
                let mappedType = tl.role.includes("social") ? "social_media" : tl.role.includes("media") ? "media_buying" : "head_seo";
                return (
                  <button
                    key={tl.id}
                    onClick={() => handleAssignToTeamLeader(assignModal.id, tl.id, mappedType)}
                    className="w-full text-left p-3 bg-slate-50 hover:bg-indigo-50 border rounded-lg transition flex justify-between items-center"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{tl.name}</p>
                      <p className="text-xs text-slate-500 capitalize">{tl.role.replace(/_/g, " ")}</p>
                    </div>
                    <span className="text-indigo-600 text-xs font-medium">Assign →</span>
                  </button>
                )
              })}
              {teamLeaders.length === 0 && <p className="text-sm text-slate-400 italic">No team leaders available</p>}
            </div>
            <button onClick={() => setAssignModal(null)} className="mt-4 w-full py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200">Cancel</button>
          </div>
        </div>
      )}

      {/* Tasks Overview (Global) */}
      <div className="bg-white rounded-xl shadow border overflow-hidden">
        <div className="p-4 border-b bg-slate-50 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">Global Tasks Execution</h2>
          <select value={taskFilter} onChange={(e) => setTaskFilter(e.target.value)} className="text-sm border rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="delayed">Delayed</option>
            <option value="done">Done</option>
          </select>
        </div>
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="min-w-full divide-y divide-gray-200 relative">
            <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Target Client</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Task Type & Brief</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Assigned Leader</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Deadline</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {kpis.allTasks
                .filter((t:any) => {
                  if(taskFilter === "all") return true;
                  if(taskFilter === "delayed") return t.status !== "done" && t.deadline && new Date(t.deadline) < new Date();
                  return t.status === taskFilter;
                })
                .sort((a:any, b:any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map((t: any) => {
                const isDelayed = t.status !== "done" && t.deadline && new Date(t.deadline) < new Date();
                const parentProject = projects.find((p:any) => p.id === t.projectId);
                return (
                 <tr key={t.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900 text-sm">{parentProject?.deal?.lead?.name || "Unknown"}</div>
                      <div className="text-xs text-slate-500">Project: {parentProject?.package || "N/A"}</div>
                    </td>
                    <td className="px-6 py-4 line-clamp-2 max-w-xs">
                      <span className="font-bold text-[10px] uppercase bg-slate-100 px-2 py-0.5 rounded text-slate-600 mr-2">{t.taskType.replace(/_/g, " ")}</span>
                      <span className="text-sm text-slate-700">{t.brief}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-semibold text-slate-800">{t.leader?.name || "Not Assigned"}</div>
                      <div className="text-xs text-slate-500">{t.agent?.name ? `Agent: ${t.agent.name}` : "Pending Agent"}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`text-sm font-medium ${isDelayed ? "text-red-600" : "text-slate-600"}`}>
                        {t.deadline ? new Date(t.deadline).toLocaleDateString() : "No Deadline"}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-0.5 text-[10px] rounded font-bold uppercase border ${t.status === "done" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : isDelayed ? "bg-red-50 text-red-700 border-red-200" : t.status === "in_progress" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-slate-50 text-slate-700 border-slate-200"}`}>
                        {isDelayed ? "DELAYED" : t.status.replace(/_/g, " ")}
                      </span>
                    </td>
                 </tr>
                )
              })}
              {kpis.allTasks.length === 0 && (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-sm text-slate-400 italic">No operational tasks generated yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
