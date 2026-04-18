"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import LifecycleStateBadge from "@/components/LifecycleStateBadge";
import DistributionPanel from "@/components/DistributionPanel";
import CrossTeamTaskForm from "@/components/CrossTeamTaskForm";

export default function MediaBuyerClient({ projects, teamMembers, userRole, userId }: any) {
  const router = useRouter();
  const [activeDistribution, setActiveDistribution] = useState<string | null>(null);
  const [crossTeamProject, setCrossTeamProject] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isTL = ["super_admin", "team_leader_media_buyer"].includes(userRole);
  const isAgent = userRole === "agent_media_buyer";

  const handleAssignAgent = async (projectId: string, agentId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/assign-agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentUserId: agentId, department: "media_buyer" }),
      });
      if (res.ok) {
        toast.success("Agent assigned successfully");
        setActiveDistribution(null);
        router.refresh();
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || "Failed to assign Agent");
      }
    } catch (e) {
      toast.error("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTaskStatus = async (taskId: string, status: string) => {
    await fetch(`/api/tasks/${taskId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-500 uppercase">Assigned Projects</span>
          <span className="text-2xl font-black">{projects.length}</span>
        </div>
        {isAgent && (
          <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-col justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase">My Active Tasks</span>
            <span className="text-2xl font-black">
              {projects.reduce((acc: number, p: any) => acc + (p.tasks || []).filter((t: any) => ["pending", "in_progress"].includes(t.status)).length, 0)}
            </span>
          </div>
        )}
      </div>

      {projects.length === 0 && (
        <div className="bg-white border rounded-xl p-8 text-center text-slate-500">
          No active projects assigned to you.
        </div>
      )}

      <div className="grid grid-cols-1 gap-6">
        {projects.map((project: any) => {
          const isDistributing = activeDistribution === project.id;
          const assignedAgents = project.teamAssignments?.filter((ta: any) => ta.role === "agent_media_buyer") || [];

          return (
            <div key={project.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 border-b p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-bold text-lg">{project.deal?.lead?.name || "Unknown Client"}</h3>
                    <LifecycleStateBadge state={project.lifecycleState || "Active"} />
                  </div>
                  <p className="text-sm text-slate-500">
                    Account Manager: <span className="font-medium text-slate-700">{project.accountManager?.name || "Not Assigned"}</span>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {isTL && (
                    <button 
                      onClick={() => setActiveDistribution(isDistributing ? null : project.id)}
                      className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
                    >
                      Assign Agent
                    </button>
                  )}
                </div>
              </div>

              {/* Distribution Panel */}
              {isDistributing && isTL && (
                <div className="p-4 border-b bg-indigo-50/50">
                  <DistributionPanel
                    title="Select Media Buyer Agent"
                    users={teamMembers.map((m: any) => ({
                      id: m.id,
                      name: m.name,
                      role: m.role,
                      taskCount: 0,
                      clientCount: m._count?.teamAssignments || 0
                    }))}
                    isLoading={loading}
                    onAssign={(targetId) => handleAssignAgent(project.id, targetId)}
                  />
                </div>
              )}

              {/* TL View: Show Agents & Tasks */}
              {isTL && assignedAgents.length > 0 && (
                <div className="p-4 bg-white space-y-4">
                  <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Assigned Agents</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {assignedAgents.map((ta: any) => {
                      const agentTasks = project.tasks?.filter((t: any) => t.agentId === ta.userId) || [];
                      return (
                        <div key={ta.id} className="border rounded-lg p-3">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="font-bold text-sm">{ta.user.name}</p>
                              <p className="text-xs text-slate-500">{ta.user.role.replace(/_/g, " ")}</p>
                            </div>
                            <span className="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded">
                              {agentTasks.length} TASKS
                            </span>
                          </div>
                          
                          <div className="space-y-2 mt-3">
                            {agentTasks.map((task: any) => (
                              <div key={task.id} className="text-xs bg-slate-50 p-2 rounded flex justify-between items-center border">
                                <span className="font-medium truncate max-w-[150px]">{task.taskType.replace(/_/g, " ")}</span>
                                <span className={`px-2 py-0.5 rounded font-bold uppercase ${
                                  task.status === "done" ? "bg-emerald-100 text-emerald-700" : 
                                  task.status === "in_progress" ? "bg-amber-100 text-amber-700" : 
                                  "bg-slate-200 text-slate-700"
                                }`}>{task.status.replace(/_/g, " ")}</span>
                              </div>
                            ))}
                            {agentTasks.length === 0 && <p className="text-xs text-slate-400 italic">No tasks created yet</p>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Agent View: Show Tasks */}
              {isAgent && (
                <div className="p-4 space-y-3">
                  <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-2">My Tasks</h4>
                  {!project.tasks || project.tasks.length === 0 ? (
                    <div className="bg-slate-50 border rounded-lg p-6 text-center text-slate-500 italic">
                      No tasks assigned yet.
                    </div>
                  ) : (
                    project.tasks.map((task: any) => (
                      <div key={task.id} className="border rounded-lg p-4 flex flex-col md:flex-row justify-between items-center bg-slate-50">
                        <div>
                          <p className="font-bold text-sm uppercase text-indigo-800 mb-1">{task.taskType.replace(/_/g, " ")}</p>
                          {task.requester && (
                            <p className="text-xs text-slate-500">Requested by: {task.requester.name} ({task.requester.role.replace(/_/g, " ")})</p>
                          )}
                        </div>
                        <div className="mt-3 md:mt-0 flex items-center gap-3">
                          <select 
                            value={task.status}
                            onChange={(e) => handleUpdateTaskStatus(task.id, e.target.value)}
                            className="border-2 border-slate-200 rounded-lg text-sm font-bold px-3 py-1.5 focus:border-indigo-500 outline-none bg-white"
                          >
                            <option value="pending">Pending / On Hold</option>
                            <option value="in_progress">In Progress</option>
                            <option value="done">Done</option>
                          </select>
                          <button 
                            onClick={() => setCrossTeamProject(project.id)}
                            className="bg-slate-800 text-white text-xs font-bold px-3 py-2 rounded-lg hover:bg-slate-900 transition"
                          >
                            + Cross-Team Task
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Cross-Team Task Modal */}
              {crossTeamProject === project.id && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                  <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
                    <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                      <h3 className="font-bold text-lg text-slate-800">Request Cross-Team Task</h3>
                      <button onClick={() => setCrossTeamProject(null)} className="text-slate-400 hover:text-slate-600 font-bold">&times;</button>
                    </div>
                    <div className="p-6">
                      <CrossTeamTaskForm projectId={project.id} onClose={() => {
                        setCrossTeamProject(null);
                        router.refresh();
                      }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
