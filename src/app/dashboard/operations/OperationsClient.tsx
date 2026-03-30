"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function OperationsClient({ 
  userRole, userId, projects, leaderTasks, agentTasks, teamLeaders, opsAgents 
}: any) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null); // For agents to view details
  
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
        <section>
          <h2 className="text-xl font-bold mb-4 text-purple-900">Account Manager: Active Projects</h2>
          <div className="bg-white rounded-xl shadow border">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-purple-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Package</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Progress (%)</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {projects.map((p: any) => (
                  <tr key={p.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{p.deal.lead.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.package}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div className="bg-purple-600 h-2.5 rounded-full" style={{ width: `${Math.max(p.seoProgress, p.socialMediaProgress)}%` }}></div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {p.tasks.length === 0 ? (
                        <button onClick={() => handleAssignProjectToLeaders(p.id, p.package)} className="px-3 py-1 bg-purple-600 text-white rounded text-xs hover:bg-purple-700">Assign to Leaders</button>
                      ) : (
                        <span className="text-xs text-green-600 font-medium">Assigned</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
