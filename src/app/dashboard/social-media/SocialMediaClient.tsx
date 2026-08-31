"use client";

import { useState, useMemo } from "react";
import { notify } from "@/components/toast";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, X, ExternalLink, Plus, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import LifecycleStateBadge from "@/components/LifecycleStateBadge";
import DistributionPanel from "@/components/DistributionPanel";
import CrossTeamTaskForm from "@/components/CrossTeamTaskForm";
import SelfTaskForm from "@/components/SelfTaskForm";
import TaskFlagModal from "@/components/TaskFlagModal";
import TaskReassignModal from "@/components/TaskReassignModal";
import TaskWorkspaceModal from "@/components/TaskWorkspaceModal";
import { assignProjectAgent } from "@/client/api/projects";
import { updateTask } from "@/client/api/tasks";

const DEPARTMENT_TASK_TYPES: Record<string, string[]> = {
  social_media: ["Social_Media", "social_media"],
  media_buyer: ["Media_Buyer", "media_buyer", "media_buying"],
};
const SUBTASK_TYPES = ["graphic_design", "motion_graphic", "ui_design"];

export default function SocialMediaClient({ projects, teamMembers, userRole, userId, departmentTaskType = "social_media" }: any) {
  const router = useRouter();
  const [activeDistribution, setActiveDistribution] = useState<string | null>(null);
  const [crossTeamProject, setCrossTeamProject] = useState<string | null>(null);
  const [flagTask, setFlagTask] = useState<any>(null);
  const [reassignTask, setReassignTask] = useState<any>(null);
  const [workspaceTask, setWorkspaceTask] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [selfTaskProject, setSelfTaskProject] = useState<string | null>(null);
  const [expandedCrossTeam, setExpandedCrossTeam] = useState<Record<string, boolean>>({});
  const [expandedSubtasks, setExpandedSubtasks] = useState<Record<string, boolean>>({});

  // ── Filter State ──
  const [activeKpi, setActiveKpi] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [taskStatusFilter, setTaskStatusFilter] = useState("all");

  const isTL = ["super_admin", "team_leader_social_media", "team_leader_media_buyer"].includes(userRole);
  const isAgent = ["agent_social_media", "agent_media_buyer"].includes(userRole);
  const deptTypes = DEPARTMENT_TASK_TYPES[departmentTaskType] || DEPARTMENT_TASK_TYPES.social_media;
  const isDeptTask = (t: any) => deptTypes.includes(t.taskType);

  // ── KPI Calculations ──
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const allTasks = projects.flatMap((p: any) => (p.tasks || []).filter(isDeptTask).map((t: any) => ({ ...t, _project: p })));
  const warningCount = projects.reduce((acc: number, p: any) => acc + (p.warnings?.length || 0), 0);
  const pendingTasks = allTasks.filter((t: any) => t.status === "pending");
  const inProgressTasks = allTasks.filter((t: any) => t.status === "in_progress");
  const doneTasks = allTasks.filter((t: any) => t.status === "done");
  const doneThisWeek = doneTasks.filter((t: any) => t.completedAt && new Date(t.completedAt) >= weekAgo);
  const delayedTasks = allTasks.filter((t: any) => t.status !== "done" && t.deadline && new Date(t.deadline) < now);

  const kpiCards = isTL ? [
    { id: "all", label: "My Projects", val: projects.length, color: "slate" },
    { id: "pending", label: "Pending Tasks", val: pendingTasks.length, color: "blue" },
    { id: "in_progress", label: "In Progress", val: inProgressTasks.length, color: "amber" },
    { id: "delayed", label: "Delayed", val: delayedTasks.length, color: "red" },
    { id: "done", label: "Completed", val: doneTasks.length, color: "emerald" },
    { id: "warnings", label: "Warnings", val: warningCount, color: "red" },
  ] : [
    { id: "all", label: "My Projects", val: projects.length, color: "slate" },
    { id: "pending", label: "Pending", val: pendingTasks.length, color: "blue" },
    { id: "in_progress", label: "In Progress", val: inProgressTasks.length, color: "amber" },
    { id: "done", label: "Completed", val: doneTasks.length, color: "emerald" },
  ];

  const colorMap: Record<string, { border: string; bg: string; text: string }> = {
    slate: { border: "border-slate-500", bg: "bg-slate-50", text: "text-slate-500" },
    blue: { border: "border-blue-500", bg: "bg-blue-50", text: "text-blue-500" },
    amber: { border: "border-amber-500", bg: "bg-amber-50", text: "text-amber-500" },
    red: { border: "border-red-500", bg: "bg-red-50", text: "text-red-500" },
    emerald: { border: "border-emerald-500", bg: "bg-emerald-50", text: "text-emerald-500" },
  };

  // ── Filtered Projects ──
  const filteredProjects = useMemo(() => {
    return projects.filter((p: any) => {
      const matchSearch = !searchQuery ||
        p.deal?.lead?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.deal?.lead?.phone?.includes(searchQuery);

      const projectTasks = (p.tasks || []).filter(isDeptTask);
      const hasDelayed = projectTasks.some((t: any) => t.status !== "done" && t.deadline && new Date(t.deadline) < now);

      let matchKpi = true;
      if (activeKpi === "in_progress") matchKpi = projectTasks.some((t: any) => t.status === "in_progress");
      else if (activeKpi === "pending") matchKpi = projectTasks.some((t: any) => t.status === "pending");
      else if (activeKpi === "delayed") matchKpi = hasDelayed;
      else if (activeKpi === "done") matchKpi = projectTasks.some((t: any) => t.status === "done");
      else if (activeKpi === "warnings") matchKpi = (p.warnings || []).length > 0;
      else if (activeKpi === "done_week") matchKpi = projectTasks.some((t: any) => t.status === "done" && t.completedAt && new Date(t.completedAt) >= weekAgo);

      let matchTaskStatus = true;
      if (taskStatusFilter !== "all") {
        matchTaskStatus = projectTasks.some((t: any) => t.status === taskStatusFilter);
      }

      return matchSearch && matchKpi && matchTaskStatus;
    });
  }, [projects, searchQuery, activeKpi, taskStatusFilter]);

  const hasActiveFilters = searchQuery || activeKpi !== "all" || taskStatusFilter !== "all";

  const clearAllFilters = () => {
    setSearchQuery("");
    setActiveKpi("all");
    setTaskStatusFilter("all");
  };

  // ── Handlers ──
  const handleAssignAgent = async (projectId: string, agentId: string) => {
    setLoading(true);
    try {
      await assignProjectAgent(projectId, { agentUserId: agentId, department: "social_media" });
      notify("Agent assigned successfully");
      setActiveDistribution(null);
      router.refresh();
    } catch (e) {
      notify(e instanceof Error ? e.message : "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTaskStatus = async (taskId: string, status: string) => {
    try {
      await updateTask(taskId, { status });
      router.refresh();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Network error — please try again");
    }
  };

  return (
    <div className="space-y-6">
      {/* ── KPI Grid (Clickable Filters) ── */}
      <div className={`grid grid-cols-2 ${kpiCards.length >= 5 ? "md:grid-cols-5" : "md:grid-cols-4"} gap-4`}>
        {kpiCards.map(k => {
          const c = colorMap[k.color];
          const isActive = activeKpi === k.id;
          return (
            <button
              key={k.id}
              onClick={() => setActiveKpi(isActive ? "all" : k.id)}
              className={`p-4 rounded-xl border-2 text-start transition cursor-pointer flex flex-col justify-between ${isActive ? `${c.border} ${c.bg}` : "border-transparent bg-white hover:bg-gray-50 shadow-sm"}`}
            >
              <span className={`text-[11px] font-bold uppercase tracking-wider ${c.text}`}>{k.label}</span>
              <p className="text-2xl font-black mt-2 text-slate-900">{k.val}</p>
            </button>
          );
        })}
      </div>

      {/* ── Filter Bar ── */}
      <div className="bg-white rounded-xl border shadow-sm p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search client name or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full ps-9 pe-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
        <select
          value={taskStatusFilter}
          onChange={(e) => setTaskStatusFilter(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
        >
          <option value="all">All Task Statuses</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="done">Done</option>
        </select>
        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="inline-flex items-center gap-1 px-3 py-2 text-xs font-bold text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition"
          >
            <X className="w-3 h-3" /> Clear Filters
          </button>
        )}
        <span className="text-xs text-slate-400 ms-auto">
          Showing {filteredProjects.length} of {projects.length} projects
        </span>
      </div>

      {/* ── Empty State ── */}
      {filteredProjects.length === 0 && (
        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-12 text-center text-slate-500">
          {hasActiveFilters ? "No projects match your current filters." : "No active projects assigned to you."}
        </div>
      )}

      {/* ── Section Title ── */}
      <h2 className="text-lg font-bold text-slate-800">{isTL ? "Social Media Projects" : "My Assigned Projects"}</h2>

      {/* ── Project Cards ── */}
      <div className="grid grid-cols-1 gap-6">
        {filteredProjects.map((project: any) => {
          const isDistributing = activeDistribution === project.id;
          const agentRole = departmentTaskType === "media_buyer" ? "agent_media_buyer" : "agent_social_media";
          const assignedAgents = project.teamAssignments?.filter((ta: any) => ta.role === agentRole) || [];
          const projectTasks = (project.tasks || []).filter(isDeptTask);
          const subTasks = (project.tasks || []).filter((t: any) => SUBTASK_TYPES.includes(t.taskType));
          const activeTasks = projectTasks.filter((t: any) => t.status !== "done").length;
          const doneCount = projectTasks.filter((t: any) => t.status === "done").length;
          const deptProgress = departmentTaskType === "media_buyer" ? (project.mediaBuyerProgress || 0) : (project.socialMediaProgress || 0);
          const warnings = project.warnings || [];
          const recentNotes = project.globalNotes || [];

          return (
            <div key={project.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              {/* Project Header */}
              <div className="bg-slate-50 border-b p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-bold text-lg">{project.deal?.lead?.name || "Unknown Client"}</h3>
                    <LifecycleStateBadge state={project.lifecycleState || "Active"} />
                    {activeTasks > 0 && (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full">
                        {activeTasks} Active
                      </span>
                    )}
                    {doneCount > 0 && (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full">
                        {doneCount} Done
                      </span>
                    )}
                    {warnings.length > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded-full">
                        <AlertTriangle className="w-3 h-3" /> {warnings.length} Warning
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500">
                    Account Manager: <span className="font-medium text-slate-700">{project.accountManager?.name || "Not Assigned"}</span>
                    {project.package && <span className="ms-3 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-bold">{project.package}</span>}
                  </p>
                  {isTL && (
                    <div className="mt-2 flex items-center gap-2 max-w-xs">
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-2 bg-purple-500 rounded-full" style={{ width: `${Math.round(deptProgress)}%` }} />
                      </div>
                      <span className="text-[11px] font-black text-purple-700">{Math.round(deptProgress)}%</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href={`/dashboard/clients/${project.id}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-900 transition shadow-sm"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Client Full Journey
                  </Link>
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
                    title="Select Social Media Agent"
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
              {isTL && (
                <div className="p-4 bg-white space-y-4">
                  {recentNotes.length > 0 && (
                    <div className="border rounded-lg p-3 bg-slate-50">
                      <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Latest Sales / Account Notes</h4>
                      <div className="space-y-1.5">
                        {recentNotes.slice(0, 2).map((note: any) => (
                          <div key={note.id} className="text-xs text-slate-600">
                            <span className="font-bold text-slate-800">{note.userName || note.userRole}:</span> {note.content}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {assignedAgents.length > 0 && (
                    <>
                      <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Assigned Agents</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {assignedAgents.map((ta: any) => {
                          const agentTasks = projectTasks.filter((t: any) => t.agentId === ta.userId);
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
                                  <div key={task.id} className={`text-xs p-2 rounded flex justify-between items-center gap-2 border ${task.status === "review" ? "bg-purple-50 border-purple-200" : "bg-slate-50"}`}>
                                    <span className="font-medium truncate flex-1">
                                      {task.taskType.replace(/_/g, " ")}
                                      {task.status === "review" && <span className="ms-1 text-purple-600 font-bold">· needs review</span>}
                                    </span>
                                    <select
                                      value={task.status}
                                      onChange={(e) => handleUpdateTaskStatus(task.id, e.target.value)}
                                      className="border rounded px-1.5 py-1 text-[10px] font-bold bg-white outline-none focus:border-indigo-500"
                                    >
                                      <option value="pending">Pending</option>
                                      <option value="in_progress">In Progress</option>
                                      <option value="review">Review</option>
                                      <option value="done">Done</option>
                                    </select>
                                    <button
                                      onClick={() => setReassignTask(task)}
                                      className="text-blue-600 hover:text-blue-800 text-[10px] font-bold underline shrink-0"
                                    >
                                      Reassign
                                    </button>
                                  </div>
                                ))}
                                {agentTasks.length === 0 && <p className="text-xs text-slate-400 italic">No tasks created yet</p>}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )}

                  {/* Design / Motion / UI subtasks raised for this client */}
                  {subTasks.length > 0 && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <button
                        onClick={() => setExpandedSubtasks(prev => ({ ...prev, [project.id]: !(prev[project.id] ?? false) }))}
                        className="w-full flex items-center justify-between px-4 py-3 bg-slate-100 hover:bg-slate-200 transition text-sm font-bold text-slate-700"
                      >
                        <span>🎨 Design / Motion / UI Requests ({subTasks.length})</span>
                        {(expandedSubtasks[project.id] ?? false) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                      {(expandedSubtasks[project.id] ?? false) && (
                        <div className="p-3 space-y-2 bg-white">
                          {subTasks.map((st: any) => {
                            const stDelayed = st.status !== "done" && st.deadline && new Date(st.deadline) < now;
                            return (
                              <div key={st.id} className="border rounded-lg p-2.5 flex items-center justify-between gap-2 bg-slate-50">
                                <span className="text-[11px] font-bold uppercase text-slate-600">{st.taskType.replace(/_/g, " ")}</span>
                                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                                  <span>{st.agent?.name || "Unassigned"}</span>
                                  <span className={`px-1.5 py-0.5 rounded font-bold uppercase border ${
                                    st.status === "done" ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                                    stDelayed ? "bg-red-100 text-red-700 border-red-200" :
                                    st.status === "in_progress" ? "bg-amber-100 text-amber-700 border-amber-200" :
                                    "bg-slate-100 text-slate-600 border-slate-200"
                                  }`}>{stDelayed ? "DELAYED" : st.status.replace(/_/g, " ")}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Agent View: Show Tasks */}
              {isAgent && (
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider">My Tasks</h4>
                    <button
                      onClick={() => setSelfTaskProject(project.id)}
                      className="inline-flex items-center gap-1.5 bg-emerald-600 text-white text-xs font-bold px-3 py-2 rounded-lg hover:bg-emerald-700 transition shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add My Task
                    </button>
                  </div>
                  {projectTasks.length === 0 ? (
                    <div className="bg-slate-50 border rounded-lg p-6 text-center text-slate-500 italic">
                      No tasks yet. Click "Add My Task" to organize your work.
                    </div>
                  ) : (
                    projectTasks.map((task: any) => {
                      const isSelfManaged = task.leaderId && task.agentId && task.leaderId === task.agentId;
                      return (
                        <div key={task.id} className={`border rounded-lg p-4 flex flex-col md:flex-row justify-between items-center ${isSelfManaged ? "bg-emerald-50/50 border-emerald-200" : "bg-slate-50"}`}>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-bold text-sm uppercase text-indigo-800">{task.taskType.replace(/_/g, " ")}</p>
                              {isSelfManaged && (
                                <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-bold rounded uppercase border border-emerald-200">🔓 Self-Managed</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded uppercase border ${
                                task.priority === "Urgent" || task.priority === "High" ? "bg-red-100 text-red-700 border-red-200" :
                                task.priority === "Low" ? "bg-slate-100 text-slate-600 border-slate-200" :
                                "bg-amber-100 text-amber-700 border-amber-200"
                              }`}>{task.priority || "Medium"}</span>
                              <span className="text-[10px] font-bold text-indigo-700">{Math.round(task.progressPct || 0)}%</span>
                            </div>
                            {task.brief && <p className="text-xs text-slate-600 mb-1">{task.brief}</p>}
                            {task.requesterRole && !isSelfManaged && (
                              <p className="text-xs text-slate-500">Requested by: {task.requesterRole.replace(/_/g, " ")}</p>
                            )}
                            {task.deadline && (
                              <p className={`text-xs mt-1 font-medium ${new Date(task.deadline) < now ? "text-red-600" : "text-slate-500"}`}>
                                Deadline: {new Date(task.deadline).toLocaleDateString()}
                                {new Date(task.deadline) < now && task.status !== "done" && " ⚠️ OVERDUE"}
                              </p>
                            )}
                          </div>
                          <div className="mt-3 md:mt-0 flex items-center gap-3 flex-wrap">
                            <button
                              onClick={() => setWorkspaceTask({ task, clientName: project.deal?.lead?.name, notes: project.globalNotes || [], projectId: project.id })}
                              className="bg-indigo-600 text-white text-xs font-bold px-3 py-2 rounded-lg hover:bg-indigo-700 transition"
                            >
                              Open Workspace
                            </button>
                            <select
                              value={task.status}
                              onChange={(e) => handleUpdateTaskStatus(task.id, e.target.value)}
                              className="border-2 border-slate-200 rounded-lg text-sm font-bold px-3 py-1.5 focus:border-indigo-500 outline-none bg-white"
                            >
                              <option value="pending">Pending / On Hold</option>
                              <option value="in_progress">In Progress</option>
                              <option value="review">Submit for Review</option>
                            </select>
                            <button
                              onClick={() => setCrossTeamProject(project.id)}
                              className="bg-slate-800 text-white text-xs font-bold px-3 py-2 rounded-lg hover:bg-slate-900 transition"
                            >
                              + Cross-Team Task
                            </button>
                            <button
                              onClick={() => setFlagTask(task)}
                              className="bg-orange-50 text-orange-700 border border-orange-200 text-xs font-bold px-3 py-2 rounded-lg hover:bg-orange-100 transition"
                            >
                              ⚑ Flag
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}

                  {/* ── Cross-Team Tasks (Other Teams) ── */}
                  {(() => {
                    const crossTeamTasks = project.crossTeamTasks || [];
                    if (crossTeamTasks.length === 0) return null;
                    const isExpanded = expandedCrossTeam[project.id] ?? false;

                    const deptColorMap: Record<string, { bg: string; text: string; border: string; icon: string }> = {
                      seo: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", icon: "🔍" },
                      content_seo: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", icon: "🔍" },
                      social_media: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200", icon: "📱" },
                      graphic_design: { bg: "bg-pink-50", text: "text-pink-700", border: "border-pink-200", icon: "🎨" },
                      motion_graphic: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200", icon: "🎬" },
                      ui_design: { bg: "bg-cyan-50", text: "text-cyan-700", border: "border-cyan-200", icon: "🖥️" },
                      media_buyer: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", icon: "📊" },
                    };
                    const defaultDept = { bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-200", icon: "📋" };

                    return (
                      <div className="mt-4 border border-slate-200 rounded-xl overflow-hidden">
                        <button
                          onClick={() => setExpandedCrossTeam(prev => ({ ...prev, [project.id]: !isExpanded }))}
                          className="w-full flex items-center justify-between px-4 py-3 bg-slate-100 hover:bg-slate-200 transition text-sm font-bold text-slate-700"
                        >
                          <span>👁️ Other Teams Tasks ({crossTeamTasks.length})</span>
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        {isExpanded && (
                          <div className="p-3 space-y-2 bg-white">
                            {crossTeamTasks.map((ct: any) => {
                              const dept = deptColorMap[ct.taskType] || defaultDept;
                              const isDelayed = ct.status !== "done" && ct.deadline && new Date(ct.deadline) < now;
                              return (
                                <div key={ct.id} className={`${dept.bg} ${dept.border} border rounded-lg p-3`}>
                                  <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <div className="flex items-center gap-2">
                                      <span className="text-base">{dept.icon}</span>
                                      <span className={`text-[10px] font-bold uppercase ${dept.text}`}>{ct.taskType.replace(/_/g, " ")}</span>
                                      <span className={`px-1.5 py-0.5 text-[9px] rounded font-bold uppercase border ${
                                        ct.status === "done" ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                                        isDelayed ? "bg-red-100 text-red-700 border-red-200" :
                                        ct.status === "in_progress" ? "bg-amber-100 text-amber-700 border-amber-200" :
                                        "bg-slate-100 text-slate-600 border-slate-200"
                                      }`}>{isDelayed ? "DELAYED" : ct.status.replace(/_/g, " ")}</span>
                                    </div>
                                    <div className="text-[10px] text-slate-500">
                                      {ct.agent?.name || "Unassigned"}
                                      {ct.deadline && (
                                        <span className={`ms-2 ${isDelayed ? "text-red-600 font-bold" : ""}`}>
                                          Due: {new Date(ct.deadline).toLocaleDateString()}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  {ct.brief && <p className="text-xs text-slate-600 mt-1.5 line-clamp-2">{ct.brief}</p>}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })()}
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
                      <CrossTeamTaskForm projectId={project.id} userRole={userRole} onClose={() => {
                        setCrossTeamProject(null);
                        router.refresh();
                      }} />
                    </div>
                  </div>
                </div>
              )}

              {/* Self-Task Modal */}
              {selfTaskProject === project.id && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                  <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
                    <div className="p-4 border-b bg-emerald-50 flex justify-between items-center">
                      <h3 className="font-bold text-lg text-slate-800">📝 Create My Task</h3>
                      <button onClick={() => setSelfTaskProject(null)} className="text-slate-400 hover:text-slate-600 font-bold">&times;</button>
                    </div>
                    <div className="p-6">
                      <SelfTaskForm projectId={project.id} userRole={userRole} onClose={() => {
                        setSelfTaskProject(null);
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

      {/* ── Aggregated My Tasks ── */}
      {allTasks.length > 0 && (
        <div className="bg-white rounded-xl shadow border overflow-hidden">
          <div className="p-4 border-b bg-slate-50">
            <h2 className="text-lg font-bold text-slate-800">My Tasks Overview</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-start text-xs font-semibold text-slate-500 uppercase">Client</th>
                  <th className="px-6 py-3 text-start text-xs font-semibold text-slate-500 uppercase">Task Type</th>
                  <th className="px-6 py-3 text-start text-xs font-semibold text-slate-500 uppercase">Brief</th>
                  <th className="px-6 py-3 text-start text-xs font-semibold text-slate-500 uppercase">Deadline</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {allTasks.map((t: any) => {
                  const isDelayed = t.status !== "done" && t.deadline && new Date(t.deadline) < now;
                  return (
                    <tr key={t.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4 font-bold text-sm text-slate-900">{t._project?.deal?.lead?.name || "Unknown"}</td>
                      <td className="px-6 py-4"><span className="font-bold text-[10px] uppercase bg-slate-100 px-2 py-0.5 rounded text-slate-600">{t.taskType?.replace(/_/g, " ")}</span></td>
                      <td className="px-6 py-4 text-sm text-slate-700 max-w-xs truncate">{t.brief || "—"}</td>
                      <td className="px-6 py-4"><span className={`text-sm font-medium ${isDelayed ? "text-red-600" : "text-slate-600"}`}>{t.deadline ? new Date(t.deadline).toLocaleDateString() : "No Deadline"}</span></td>
                      <td className="px-6 py-4 text-center"><span className={`px-2 py-0.5 text-[10px] rounded font-bold uppercase border ${t.status === "done" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : isDelayed ? "bg-red-50 text-red-700 border-red-200" : t.status === "in_progress" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-slate-50 text-slate-700 border-slate-200"}`}>{isDelayed ? "DELAYED" : (t.status || "pending").replace(/_/g, " ")}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {flagTask && (
        <TaskFlagModal
          taskId={flagTask.id}
          taskName={flagTask.taskType.replace(/_/g, " ")}
          isOpen={!!flagTask}
          onClose={() => setFlagTask(null)}
          onSuccess={() => { setFlagTask(null); router.refresh(); }}
        />
      )}

      {reassignTask && (
        <TaskReassignModal
          taskId={reassignTask.id}
          taskName={reassignTask.taskType.replace(/_/g, " ")}
          taskType={reassignTask.taskType}
          leaderRole={userRole}
          currentAgentId={reassignTask.agentId}
          isOpen={!!reassignTask}
          onClose={() => setReassignTask(null)}
          onSuccess={() => { setReassignTask(null); router.refresh(); }}
        />
      )}

      {workspaceTask && (
        <TaskWorkspaceModal
          task={workspaceTask.task}
          projectId={workspaceTask.projectId}
          clientName={workspaceTask.clientName}
          contextNotes={workspaceTask.notes}
          userRole={userRole}
          onClose={() => setWorkspaceTask(null)}
          onSuccess={() => router.refresh()}
          onFlag={() => { setFlagTask(workspaceTask.task); setWorkspaceTask(null); }}
        />
      )}
    </div>
  );
}
