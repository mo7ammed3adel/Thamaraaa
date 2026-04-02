"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function OperationsClient({ 
  userRole, userId, projects, leaderTasks, agentTasks, teamLeaders, opsAgents 
}: any) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null); // For agents to view details
  const [viewProject, setViewProject] = useState<any>(null); // For AM to view Project Details Drawer

  // Modal Sub-Component for AM Project Details
  const ProjectDetailsModal = ({ project, onClose }: { project: any, onClose: () => void }) => {
    const [logs, setLogs] = useState<any[]>([]);
    const [files, setFiles] = useState<any[]>([]);

    // We fetch logs and files lazily when modal opens
    return (
      <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-sm">
        <div className="w-full max-w-2xl bg-white h-full shadow-2xl p-6 overflow-y-auto animate-in slide-in-from-right flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-slate-800">Project Details</h2>
            <button onClick={onClose} className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full hover:bg-slate-200">Close x</button>
          </div>

          <div className="space-y-6 flex-1">
            {/* Overview */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <h3 className="font-semibold text-slate-700 mb-2">Overview</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-slate-500 block">Client Name</span><span className="font-medium">{project.deal.lead.name}</span></div>
                <div><span className="text-slate-500 block">Package</span><span className="font-medium text-purple-700">{project.package}</span></div>
                <div><span className="text-slate-500 block">Niche</span><span className="font-medium">{project.niche || "N/A"}</span></div>
                <div><span className="text-slate-500 block">Status</span><span className="font-medium capitalize">{project.projectStatus.replace("_", " ")}</span></div>
              </div>
            </div>

            {/* Assignments */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="font-semibold text-slate-700 mb-3">Service Handoff</h3>
              {project.tasks?.length > 0 ? (
                  <ul className="space-y-2">
                      {project.tasks.map((t: any) => (
                          <li key={t.id} className="flex justify-between text-sm p-2 bg-slate-50 rounded">
                              <span className="font-medium text-slate-700">{t.taskType.replace("_", " ")}</span>
                              <span className="text-slate-500">Leader: {t.leader?.name || "Assigned"}</span>
                          </li>
                      ))}
                  </ul>
              ) : (
                  <div className="text-sm text-slate-500 italic">No tasks have been assigned to leaders yet.</div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-4 border-t border-slate-100">
                <button className="flex-1 bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg font-medium text-sm hover:bg-slate-50">Upload File</button>
                <button className="flex-1 bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg font-medium text-sm hover:bg-slate-50">Change Status</button>
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  // AM Assign Project to TLs
  const handleAssignProjectToLeaders = async (projectId: string, packageType: string) => {
    // simplified mock allocation: auto assign to first available leaders
    const tlSeo = teamLeaders.find((l: any) => l.name.includes("SEO")) || teamLeaders[0];
    const tlSocial = teamLeaders.find((l: any) => l.name.includes("Social")) || teamLeaders[0];
    
    // Call API to create tasks based on packageType
    await fetch("/api/tasks/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, packageType, seoLeaderId: tlSeo?.id, socialLeaderId: tlSocial?.id })
    });
    router.refresh();
  };

  // TL Assign Task to Agent
  const handleAssignTask = async (taskId: string, agentId: string) => {
    await fetch("/api/tasks/" + taskId, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId })
    });
    router.refresh();
  };

  // Agent toggles Checkbox
  const toggleChecklistItem = async (task: any, itemId: string) => {
    let checklists = [];
    try {
      checklists = JSON.parse(task.checklistItems || "[]");
    } catch(e) {}

    const updatedChecklists = checklists.map((c: any) => 
      c.id === itemId ? { ...c, completed: !c.completed } : c
    );
    
    const completedCount = updatedChecklists.filter((c: any) => c.completed).length;
    const totalCount = updatedChecklists.length;
    const newProgress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    await fetch("/api/tasks/" + task.id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        progressPct: newProgress,
        checklistItems: JSON.stringify(updatedChecklists)
      })
    });
    router.refresh();
  };

  const isAM = userRole === "account_manager" || userRole === "super_admin";
  const isTL = userRole === "team_leader" || userRole === "super_admin";
  const isAgent = userRole === "operations_agent" || userRole === "super_admin";

  return (
    <div className="space-y-12">
      {/* Account Manager View */}
      {isAM && (
        <section className="space-y-6">
          <h2 className="text-xl font-bold text-slate-800">Account Manager Dashboard</h2>
          
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-col justify-center items-center">
                <span className="text-sm font-medium text-slate-500">Total Projects</span>
                <span className="text-2xl font-bold text-slate-800">{projects.length}</span>
            </div>
            <div className="bg-indigo-50 border-indigo-100 p-4 rounded-xl border shadow-sm flex flex-col justify-center items-center">
                <span className="text-sm font-medium text-indigo-600">Setup Phase</span>
                <span className="text-2xl font-bold text-indigo-700">{projects.filter((p: any) => p.projectStatus === "setup").length}</span>
            </div>
            <div className="bg-blue-50 border-blue-100 p-4 rounded-xl border shadow-sm flex flex-col justify-center items-center">
                <span className="text-sm font-medium text-blue-600">Active</span>
                <span className="text-2xl font-bold text-blue-700">{projects.filter((p: any) => p.projectStatus === "in_progress" || p.projectStatus === "assigned").length}</span>
            </div>
            <div className="bg-red-50 border-red-100 p-4 rounded-xl border shadow-sm flex flex-col justify-center items-center">
                <span className="text-sm font-medium text-red-600">Delayed</span>
                <span className="text-2xl font-bold text-red-700">{projects.filter((p: any) => p.projectStatus === "delayed").length}</span>
            </div>
            <div className="bg-emerald-50 border-emerald-100 p-4 rounded-xl border shadow-sm flex flex-col justify-center items-center">
                <span className="text-sm font-medium text-emerald-600">Completed</span>
                <span className="text-2xl font-bold text-emerald-700">{projects.filter((p: any) => p.projectStatus === "completed").length}</span>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow border overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Client & Deal</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Type / Timeline</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Progress Tracking</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {projects.map((p: any) => {
                  const getProgressColor = (val: number) => val < 30 ? "bg-red-500" : val < 70 ? "bg-amber-400" : "bg-emerald-500";
                  
                  return (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-bold text-slate-900">{p.deal.lead.name}</div>
                        <div className="text-xs font-medium text-slate-500">{p.deal.lead.phone} • {p.niche || "No Niche"}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                        <div className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 mb-1">
                            {p.package}
                        </div>
                        <div className="text-xs text-slate-500">
                            Deadline: {p.finalDeadline ? new Date(p.finalDeadline).toLocaleDateString() : "Not Set"}
                        </div>
                    </td>
                    <td className="px-6 py-4">
                        <div className="w-full max-w-xs space-y-2">
                            {/* SEO */}
                            <div className="flex items-center text-xs">
                                <span className="w-12 font-medium text-slate-600">SEO</span>
                                <div className="flex-1 bg-slate-200 rounded-full h-1.5 mx-2 overflow-hidden">
                                    <div className={`${getProgressColor(p.seoProgress)} h-1.5 rounded-full`} style={{ width: `${p.seoProgress}%` }}></div>
                                </div>
                                <span className="w-8 text-right font-medium text-slate-700">{p.seoProgress.toFixed(0)}%</span>
                            </div>
                            {/* Social */}
                            <div className="flex items-center text-xs">
                                <span className="w-12 font-medium text-slate-600">Social</span>
                                <div className="flex-1 bg-slate-200 rounded-full h-1.5 mx-2 overflow-hidden">
                                    <div className={`${getProgressColor(p.socialMediaProgress)} h-1.5 rounded-full`} style={{ width: `${p.socialMediaProgress}%` }}></div>
                                </div>
                                <span className="w-8 text-right font-medium text-slate-700">{p.socialMediaProgress.toFixed(0)}%</span>
                            </div>
                            {/* Media */}
                            <div className="flex items-center text-xs">
                                <span className="w-12 font-medium text-slate-600">Media</span>
                                <div className="flex-1 bg-slate-200 rounded-full h-1.5 mx-2 overflow-hidden">
                                    <div className={`${getProgressColor(p.mediaBuyerProgress)} h-1.5 rounded-full`} style={{ width: `${p.mediaBuyerProgress}%` }}></div>
                                </div>
                                <span className="w-8 text-right font-medium text-slate-700">{p.mediaBuyerProgress.toFixed(0)}%</span>
                            </div>
                        </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                        {p.projectStatus === "setup" && <span className="px-2 py-1 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-700">Setup Pending</span>}
                        {p.projectStatus === "assigned" && <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-700">Assigned</span>}
                        {p.projectStatus === "in_progress" && <span className="px-2 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-700">In Progress</span>}
                        {p.projectStatus === "delayed" && <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-700">Delayed</span>}
                        {p.projectStatus === "completed" && <span className="px-2 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-700">Completed</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {p.projectStatus === "setup" ? (
                        <button onClick={() => handleAssignProjectToLeaders(p.id, p.package)} className="px-3 py-1.5 bg-indigo-600 text-white rounded text-xs font-medium hover:bg-indigo-700 shadow-sm transition">
                            Assign Leaders
                        </button>
                      ) : (
                        <button onClick={() => setViewProject(p)} className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded text-xs font-medium hover:bg-slate-50 transition">
                            View Details
                        </button>
                      )}
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
          
          {viewProject && (
              <ProjectDetailsModal project={viewProject} onClose={() => setViewProject(null)} />
          )}
        </section>
      )}

      {/* Team Leader View */}
      {isTL && (
        <section>
          <h2 className="text-xl font-bold mb-4 text-orange-900">Team Leader: Pending Tasks</h2>
          <div className="bg-white rounded-xl shadow border">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-orange-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Project</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Task Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assign Agent</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Agent Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {leaderTasks.map((t: any) => (
                  <tr key={t.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{t.project?.deal?.lead?.name || "Unknown"}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{t.taskType}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {t.agentId ? (
                        <span className="text-gray-900 font-medium">{t.agent.name}</span>
                      ) : (
                        <select onChange={e => handleAssignTask(t.id, e.target.value)} className="border rounded p-1 text-sm bg-gray-50">
                          <option value="">Assign...</option>
                          {opsAgents.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-bold">{t.progressPct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Operations Agent View */}
      {isAgent && (
        <section>
          <h2 className="text-xl font-bold mb-4 text-green-900">My Operations Tasks</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {agentTasks.map((t: any) => {
              let checklists = [];
              try { checklists = JSON.parse(t.checklistItems || "[]"); } catch(e) {}
              
              return (
              <div key={t.id} className="bg-white rounded-xl shadow border p-5 hover:shadow-md transition">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="font-bold text-gray-900">{t.project?.deal?.lead?.name}</h3>
                  <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded font-medium">{t.taskType}</span>
                </div>
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Progress</span>
                    <span>{t.progressPct}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div className="bg-green-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${t.progressPct}%` }}></div>
                  </div>
                </div>
                
                <div className="space-y-2 mt-4 border-t pt-4">
                  <h4 className="text-sm font-semibold text-gray-700">Checklist</h4>
                  {checklists.map((item: any) => (
                    <label key={item.id} className="flex items-center gap-3 cursor-pointer group">
                      <input 
                        type="checkbox" 
                        checked={item.completed} 
                        onChange={() => toggleChecklistItem(t, item.id)}
                        className="w-4 h-4 text-green-600 rounded border-gray-300 focus:ring-green-500"
                      />
                      <span className={`text-sm select-none ${item.completed ? 'text-gray-400 line-through' : 'text-gray-700 group-hover:text-green-700'}`}>
                        {item.title}
                      </span>
                    </label>
                  ))}
                  {checklists.length === 0 && <p className="text-xs text-gray-500 italic">No checklist items defined.</p>}
                </div>
              </div>
            )})}
            {agentTasks.length === 0 && <p className="text-gray-500 text-sm col-span-full text-center py-8">No tasks assigned to you right now.</p>}
          </div>
        </section>
      )}
    </div>
  );
}
