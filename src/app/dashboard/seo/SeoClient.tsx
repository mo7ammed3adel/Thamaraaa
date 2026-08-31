"use client";

import { useState } from "react";
import { notify } from "@/components/toast";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Inbox, Clock, CheckCircle, AlertTriangle, Users, Search, X, ExternalLink, Plus, ChevronDown, ChevronUp } from "lucide-react";
import LifecycleStateBadge from "@/components/LifecycleStateBadge";
import DistributionPanel from "@/components/DistributionPanel";
import TeamOverview from "@/components/TeamOverview";
import CrossTeamTaskForm from "@/components/CrossTeamTaskForm";
import SelfTaskForm from "@/components/SelfTaskForm";
import TaskFlagModal from "@/components/TaskFlagModal";
import TaskReassignModal from "@/components/TaskReassignModal";
import TaskWorkspaceModal from "@/components/TaskWorkspaceModal";
import { assignProjectAgent, updateProjectTeamAssignment } from "@/client/api/projects";
import { updateTask } from "@/client/api/tasks";
import { useTranslator } from "@/components/i18n/LocaleProvider";

export default function SeoClient({ projects, teamMembers, contentAgents = [], userRole, userId }: any) {
  const t = useTranslator();
  const router = useRouter();
  const [activeDistribution, setActiveDistribution] = useState<{ projectId: string; mode: "leader" | "seo" | "content_seo" } | null>(null);
  const [crossTeamProject, setCrossTeamProject] = useState<string | null>(null);
  const [contentTaskProject, setContentTaskProject] = useState<string | null>(null);
  const [assigningContentTaskId, setAssigningContentTaskId] = useState<string | null>(null);
  const [flagTask, setFlagTask] = useState<any>(null);
  const [reassignTask, setReassignTask] = useState<any>(null);
  const [workspaceTask, setWorkspaceTask] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [selfTaskProject, setSelfTaskProject] = useState<string | null>(null);
  const [expandedCrossTeam, setExpandedCrossTeam] = useState<Record<string, boolean>>({});

  // ── Filter State ──
  const [activeKpi, setActiveKpi] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [taskStatusFilter, setTaskStatusFilter] = useState("all");

  const isHead = ["super_admin", "head_seo"].includes(userRole);
  const isTL = userRole === "team_leader_seo";
  const isAgent = ["agent_seo", "agent_content_seo"].includes(userRole);
  const SEO_TASK_TYPES = ["SEO", "seo", "content_seo"];
  const isSeoTask = (task: any) => SEO_TASK_TYPES.includes(task.taskType);
  const hasSeoTeamLeader = (project: any) =>
    (project.teamAssignments || []).some((ta: any) => ta.role === "team_leader_seo" && ta.status === "active") ||
    (project.tasks || []).some((task: any) => task.leader?.role === "team_leader_seo");

  // ── KPI Calculations ──
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const allTasks = projects.flatMap((p: any) => (p.tasks || []).filter(isSeoTask).map((t: any) => ({ ...t, _project: p })));
  const pendingTasks = allTasks.filter((t: any) => t.status === "pending");
  const inProgressTasks = allTasks.filter((t: any) => t.status === "in_progress");
  const reviewTasks = allTasks.filter((t: any) => t.status === "review");
  const doneTasks = allTasks.filter((t: any) => t.status === "done");
  const doneThisWeek = doneTasks.filter((t: any) => t.completedAt && new Date(t.completedAt) >= weekAgo);
  const delayedTasks = allTasks.filter((t: any) => t.status !== "done" && t.deadline && new Date(t.deadline) < now);
  const contentTasks = allTasks.filter((t: any) => t.taskType === "content_seo");
  const activeContentTasks = contentTasks.filter((t: any) => t.status !== "done");
  const warningCount = projects.reduce((acc: number, p: any) => acc + (p.warnings?.length || 0), 0);
  const unassignedProjects = projects.filter((p: any) => !hasSeoTeamLeader(p));

  const kpiCards = isHead ? [
    { id: "all", label: "Total Projects", val: projects.length, color: "slate" },
    { id: "unassigned", label: "Unassigned", val: unassignedProjects.length, color: "purple" },
    { id: "in_progress", label: "SEO Active", val: inProgressTasks.length, color: "amber" },
    { id: "content", label: "Content Active", val: activeContentTasks.length, color: "blue" },
    { id: "delayed", label: "Delayed", val: delayedTasks.length, color: "red" },
    { id: "warnings", label: "Warnings", val: warningCount, color: "red" },
  ] : isTL ? [
    { id: "all", label: "My Projects", val: projects.length, color: "slate" },
    { id: "pending", label: "Pending Tasks", val: pendingTasks.length, color: "blue" },
    { id: "in_progress", label: "In Progress", val: inProgressTasks.length, color: "amber" },
    { id: "review", label: "In Review", val: reviewTasks.length, color: "purple" },
    { id: "delayed", label: "Delayed", val: delayedTasks.length, color: "red" },
    { id: "warnings", label: "Warnings", val: warningCount, color: "red" },
  ] : [
    { id: "all", label: "My Projects", val: projects.length, color: "slate" },
    { id: "pending", label: "Pending", val: pendingTasks.length, color: "blue" },
    { id: "in_progress", label: "In Progress", val: inProgressTasks.length, color: "amber" },
    { id: "done", label: "Completed", val: doneTasks.length, color: "emerald" },
  ];

  const colorMap: Record<string, { border: string; bg: string; text: string }> = {
    slate: { border: "border-slate-500", bg: "bg-slate-50", text: "text-slate-500" },
    purple: { border: "border-purple-500", bg: "bg-purple-50", text: "text-purple-500" },
    blue: { border: "border-blue-500", bg: "bg-blue-50", text: "text-blue-500" },
    amber: { border: "border-amber-500", bg: "bg-amber-50", text: "text-amber-500" },
    red: { border: "border-red-500", bg: "bg-red-50", text: "text-red-500" },
    emerald: { border: "border-emerald-500", bg: "bg-emerald-50", text: "text-emerald-500" },
  };

  // ── Filtered Projects ──
  const filteredProjects = projects.filter((p: any) => {
    const matchSearch = !searchQuery ||
      p.deal?.lead?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.deal?.lead?.phone?.includes(searchQuery);

    const projectTasks = (p.tasks || []).filter(isSeoTask);
    const hasDelayed = projectTasks.some((t: any) => t.status !== "done" && t.deadline && new Date(t.deadline) < now);

    let matchKpi = true;
    if (activeKpi === "unassigned") matchKpi = !hasSeoTeamLeader(p);
    else if (activeKpi === "in_progress") matchKpi = projectTasks.some((t: any) => t.status === "in_progress");
    else if (activeKpi === "content") matchKpi = projectTasks.some((t: any) => t.taskType === "content_seo" && t.status !== "done");
    else if (activeKpi === "warnings") matchKpi = (p.warnings || []).length > 0;
    else if (activeKpi === "pending") matchKpi = projectTasks.some((t: any) => t.status === "pending");
    else if (activeKpi === "delayed") matchKpi = hasDelayed;
    else if (activeKpi === "review") matchKpi = projectTasks.some((t: any) => t.status === "review");
    else if (activeKpi === "done") matchKpi = projectTasks.some((t: any) => t.status === "done");
    else if (activeKpi === "done_week") matchKpi = projectTasks.some((t: any) => t.status === "done" && t.completedAt && new Date(t.completedAt) >= weekAgo);

    let matchTaskStatus = true;
    if (taskStatusFilter !== "all") {
      matchTaskStatus = projectTasks.some((t: any) => t.status === taskStatusFilter);
    }

    return matchSearch && matchKpi && matchTaskStatus;
  });

  const hasActiveFilters = searchQuery || activeKpi !== "all" || taskStatusFilter !== "all";

  const clearAllFilters = () => {
    setSearchQuery("");
    setActiveKpi("all");
    setTaskStatusFilter("all");
  };

  // ── Handlers ──
  const handleDistributeTeam = async (projectId: string, leaderId: string) => {
    setLoading(true);
    try {
      await updateProjectTeamAssignment(projectId, {
        department: "SEO",
        assignedRoleType: "leader",
        newUserId: leaderId,
      });
      notify("Team Leader assigned successfully");
      setActiveDistribution(null);
      router.refresh();
    } catch (e) {
      notify(e instanceof Error ? e.message : "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleAssignAgent = async (projectId: string, agentId: string, department: "seo" | "content_seo") => {
    setLoading(true);
    try {
      await assignProjectAgent(projectId, { agentUserId: agentId, department });
      notify(`${department === "content_seo" ? "Content SEO" : "SEO"} Agent assigned successfully`);
      setActiveDistribution(null);
      router.refresh();
    } catch (e) {
      notify(e instanceof Error ? e.message : "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  // Head SEO distributes a pending content task to one of the content agents.
  const handleAssignContentTask = async (taskId: string, agentId: string) => {
    if (!agentId) return;
    setAssigningContentTaskId(taskId);
    try {
      await updateTask(taskId, { agentId });
      notify("Content task assigned to agent");
      router.refresh();
    } catch (e) {
      notify(e instanceof Error ? e.message : "An unexpected error occurred");
    } finally {
      setAssigningContentTaskId(null);
    }
  };

  const handleUpdateTaskStatus = async (taskId: string, status: string) => {
    try {
      await updateTask(taskId, { status });
      router.refresh();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Network error — please try again");
    }
  };

  return (
    <div className="space-y-6">
      {/* ── KPI Grid (Clickable Filters) ── */}
      <div className={`grid grid-cols-2 ${kpiCards.length >= 5 ? "md:grid-cols-3 xl:grid-cols-6" : "md:grid-cols-4"} gap-4`}>
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

      {isHead && (
        <div className="bg-white rounded-xl border shadow-sm p-5">
          <h2 className="text-lg font-bold text-slate-800 mb-4">SEO Team Leaders Workload</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {teamMembers.map((member: any) => (
              <div key={member.id} className="border rounded-lg p-4 bg-slate-50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate" title={member.name}>{member.name}</p>
                    <p className="text-xs text-slate-500 capitalize mt-0.5">{member.role.replace(/_/g, " ")}</p>
                  </div>
                  <Users className="w-4 h-4 text-indigo-500 shrink-0" />
                </div>
                <div className="mt-3 flex items-end justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Active Projects</span>
                  <span className="text-2xl font-black text-indigo-700">{member._count?.teamAssignments || 0}</span>
                </div>
              </div>
            ))}
            {teamMembers.length === 0 && (
              <p className="text-sm text-slate-400 italic">No active SEO team leaders found.</p>
            )}
          </div>
        </div>
      )}

      {isTL && (
        <div className="bg-white rounded-xl border shadow-sm p-5">
          <h2 className="text-lg font-bold text-slate-800 mb-4">SEO Agents Workload</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {teamMembers.map((member: any) => {
              const memberTasks = allTasks.filter((task: any) => task.agentId === member.id);
              const activeMemberTasks = memberTasks.filter((task: any) => task.status !== "done");
              const memberProjects = new Set(
                projects
                  .filter((project: any) => (project.teamAssignments || []).some((ta: any) => ta.userId === member.id && ta.status === "active"))
                  .map((project: any) => project.id)
              );

              return (
                <div key={member.id} className="border rounded-lg p-4 bg-slate-50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate" title={member.name}>{member.name}</p>
                      <p className="text-xs text-slate-500 capitalize mt-0.5">{member.role.replace(/_/g, " ")}</p>
                    </div>
                    <Users className="w-4 h-4 text-indigo-500 shrink-0" />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                    <div className="bg-white border rounded-md p-2">
                      <p className="text-[10px] uppercase font-bold text-slate-400">Clients</p>
                      <p className="text-lg font-black text-slate-800">{memberProjects.size}</p>
                    </div>
                    <div className="bg-white border rounded-md p-2">
                      <p className="text-[10px] uppercase font-bold text-slate-400">Active Tasks</p>
                      <p className="text-lg font-black text-indigo-700">{activeMemberTasks.length}</p>
                    </div>
                  </div>
                </div>
              );
            })}
            {teamMembers.length === 0 && (
              <p className="text-sm text-slate-400 italic">No active SEO agents found.</p>
            )}
          </div>
        </div>
      )}

      {/* ── Filter Bar ── */}
      <div className="bg-white rounded-xl border shadow-sm p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder={t("form.searchClientNameOrPhone")}
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
          <option value="all">{t("filter.allTaskStatuses")}</option>
          <option value="pending">{t("status.pending")}</option>
          <option value="in_progress">{t("status.inProgress")}</option>
          <option value="done">{t("status.done")}</option>
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
      <h2 className="text-lg font-bold text-slate-800">{isHead ? "SEO Projects" : isTL ? "My Team Projects" : "My Assigned Projects"}</h2>

      {/* ── Project Cards ── */}
      <div className="grid grid-cols-1 gap-6">
        {filteredProjects.map((project: any) => {
          const activeDistributionForProject =
            activeDistribution && activeDistribution.projectId === project.id ? activeDistribution : null;
          const activePanelMode = activeDistributionForProject?.mode || null;
          const assignedLeaders = project.teamAssignments?.filter((ta: any) => ta.role === "team_leader_seo") || [];
          const assignedAgents = project.teamAssignments?.filter((ta: any) => ["agent_seo", "agent_content_seo"].includes(ta.role)) || [];
          const projectTasks = (project.tasks || []).filter(isSeoTask);
          const currentSeoLeader = assignedLeaders[0]?.user || projectTasks.find((task: any) => task.leader?.role === "team_leader_seo")?.leader || null;
          const currentSeoAgent = assignedAgents.find((ta: any) => ta.role === "agent_seo")?.user || projectTasks.find((task: any) => ["SEO", "seo"].includes(task.taskType) && task.agent?.role === "agent_seo")?.agent || null;
          const currentContentAgent = assignedAgents.find((ta: any) => ta.role === "agent_content_seo")?.user || projectTasks.find((task: any) => task.taskType === "content_seo" && task.agent?.role === "agent_content_seo")?.agent || null;
          const activeTasks = projectTasks.filter((t: any) => t.status !== "done").length;
          const doneTasks = projectTasks.filter((t: any) => t.status === "done").length;
          const contentActive = projectTasks.filter((t: any) => t.taskType === "content_seo" && t.status !== "done").length;
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
                    {doneTasks > 0 && (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full">
                        {doneTasks} Done
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
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    href={`/dashboard/clients/${project.id}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-900 transition shadow-sm"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Client Full Journey
                  </Link>
                  {isHead && !currentSeoLeader && (
                    <button
                      onClick={() => setActiveDistribution(activePanelMode === "leader" ? null : { projectId: project.id, mode: "leader" })}
                      className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
                    >
                      Distribute to Team Leader
                    </button>
                  )}
                  {isHead && currentSeoLeader && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-sm font-medium border border-emerald-200">
                      ✓ Distributed to {currentSeoLeader.name}
                    </div>
                  )}
                  {isTL && (
                    <>
                      <button
                        onClick={() => setActiveDistribution(activePanelMode === "seo" ? null : { projectId: project.id, mode: "seo" })}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition ${currentSeoAgent ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100" : "bg-indigo-600 text-white hover:bg-indigo-700"}`}
                      >
                        {currentSeoAgent ? `SEO: ${currentSeoAgent.name}` : "Assign SEO Agent"}
                      </button>
                      <button
                        onClick={() => setContentTaskProject(project.id)}
                        className="px-4 py-2 rounded-lg text-sm font-medium transition bg-sky-600 text-white hover:bg-sky-700"
                        title="Create a Content SEO task and send it to the Head SEO to distribute"
                      >
                        {currentContentAgent ? `Send Content Task (current: ${currentContentAgent.name})` : "Send Content Task"}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Distribution Panel */}
              {activePanelMode && (isHead || isTL) && (() => {
                const targetRole =
                  activePanelMode === "leader"
                    ? "team_leader_seo"
                    : activePanelMode === "content_seo"
                      ? "agent_content_seo"
                      : "agent_seo";
                const panelUsers = teamMembers
                  .filter((member: any) => member.role === targetRole)
                  .map((member: any) => {
                    const memberTasks = allTasks.filter((task: any) => task.agentId === member.id && task.status !== "done");
                    return {
                      id: member.id,
                      name: member.name,
                      role: member.role,
                      taskCount: memberTasks.length,
                      clientCount: member._count?.teamAssignments || 0
                    };
                  });

                return (
                  <div className="p-4 border-b bg-indigo-50/50">
                    <DistributionPanel
                      title={
                        activePanelMode === "leader"
                          ? "Select SEO Team Leader"
                          : activePanelMode === "content_seo"
                            ? "Select Content SEO Agent"
                            : "Select SEO Agent"
                      }
                      users={panelUsers}
                      isLoading={loading}
                      onAssign={(targetId) =>
                        activePanelMode === "leader"
                          ? handleDistributeTeam(project.id, targetId)
                          : handleAssignAgent(project.id, targetId, activePanelMode)
                      }
                    />
                  </div>
                );
              })()}

              {/* Head/TL View: Show Agents & Tasks + Self-Task */}
              {(isHead || isTL) && (
                <div className="p-4 bg-white space-y-4">
                  {isHead && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="border rounded-lg p-3 bg-blue-50 border-blue-100">
                        <p className="text-[10px] uppercase font-bold text-blue-600">SEO Progress</p>
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-2 bg-white rounded-full overflow-hidden">
                            <div className="h-2 bg-blue-500 rounded-full" style={{ width: `${project.seoProgress || 0}%` }} />
                          </div>
                          <span className="text-xs font-black text-blue-700">{project.seoProgress || 0}%</span>
                        </div>
                      </div>
                      <div className="border rounded-lg p-3 bg-indigo-50 border-indigo-100">
                        <p className="text-[10px] uppercase font-bold text-indigo-600">Content SEO Status</p>
                        <p className="text-sm font-black text-indigo-800 mt-2">{contentActive} Active / {contentTasks.filter((t: any) => t._project?.id === project.id).length} Total</p>
                      </div>
                      <div className="border rounded-lg p-3 bg-orange-50 border-orange-100">
                        <p className="text-[10px] uppercase font-bold text-orange-600">Important Notes</p>
                        <p className="text-sm font-black text-orange-800 mt-2">{recentNotes.length} Recent</p>
                      </div>
                    </div>
                  )}

                  {isHead && recentNotes.length > 0 && (
                    <div className="border rounded-lg p-3 bg-slate-50">
                      <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">{t("journey.latestNotes")}</h4>
                      <div className="space-y-2">
                        {recentNotes.slice(0, 2).map((note: any) => (
                          <div key={note.id} className="text-xs text-slate-600">
                            <span className="font-bold text-slate-800">{note.userName || note.userRole}:</span> {note.content}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Head SEO: Content Tasks awaiting distribution to content agents */}
                  {isHead && (() => {
                    const contentSeoTasks = projectTasks.filter((t: any) => t.taskType === "content_seo");
                    if (contentSeoTasks.length === 0) return null;
                    return (
                      <div className="border border-sky-200 rounded-lg p-3 bg-sky-50/50">
                        <h4 className="text-sm font-bold text-sky-800 uppercase tracking-wider mb-3">Content SEO Tasks — Distribute</h4>
                        <div className="space-y-2">
                          {contentSeoTasks.map((task: any) => (
                            <div key={task.id} className="bg-white border rounded-lg p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                    task.status === "done" ? "bg-emerald-100 text-emerald-700" :
                                    task.status === "in_progress" ? "bg-amber-100 text-amber-700" :
                                    task.status === "review" ? "bg-purple-100 text-purple-700" :
                                    "bg-slate-200 text-slate-700"
                                  }`}>{task.status.replace(/_/g, " ")}</span>
                                  {task.priority && <span className="text-[10px] font-bold text-slate-400 uppercase">{task.priority}</span>}
                                </div>
                                {task.brief && <p className="text-xs text-slate-600 mt-1 line-clamp-2">{task.brief}</p>}
                              </div>
                              {task.agentId ? (
                                <span className="shrink-0 inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-medium border border-emerald-200">
                                  ✓ {task.agent?.name || "Assigned"}
                                </span>
                              ) : (
                                <div className="shrink-0 flex items-center gap-2">
                                  <select
                                    defaultValue=""
                                    disabled={assigningContentTaskId === task.id || contentAgents.length === 0}
                                    onChange={(e) => handleAssignContentTask(task.id, e.target.value)}
                                    className="border rounded-lg px-2 py-1.5 text-xs bg-white outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50"
                                  >
                                    <option value="" disabled>
                                      {contentAgents.length === 0 ? "No content agents" : assigningContentTaskId === task.id ? "Assigning..." : "Assign to content agent…"}
                                    </option>
                                    {contentAgents.map((agent: any) => (
                                      <option key={agent.id} value={agent.id}>{agent.name}</option>
                                    ))}
                                  </select>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Agents List */}
                  {assignedAgents.length > 0 && (
                    <>
                      <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider">{t("task.assignedAgents")}</h4>
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
                                  <div key={task.id} className="text-xs bg-slate-50 p-2 rounded flex justify-between items-center border">
                                    <span className="font-medium truncate max-w-[150px]">{task.taskType.replace(/_/g, " ")}</span>
                                    <span className={`px-2 py-0.5 rounded font-bold uppercase ${
                                      task.status === "done" ? "bg-emerald-100 text-emerald-700" : 
                                      task.status === "in_progress" ? "bg-amber-100 text-amber-700" : 
                                      "bg-slate-200 text-slate-700"
                                    }`}>{task.status.replace(/_/g, " ")}</span>
                                    {isTL && (
                                      <button
                                        onClick={() => setReassignTask(task)}
                                        className="ms-2 text-blue-600 hover:text-blue-800 text-[10px] font-bold underline"
                                      >
                                        Reassign
                                      </button>
                                    )}
                                  </div>
                                ))}
                                {agentTasks.length === 0 && <p className="text-xs text-slate-400 italic">{t("task.noneYet")}</p>}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )}

                  {/* Self-Task Section for Head/TL */}
                  <div className="border-t pt-4 mt-4 space-y-3">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider">{t("task.mine")}</h4>
                      <button
                        onClick={() => setSelfTaskProject(project.id)}
                        className="inline-flex items-center gap-1.5 bg-emerald-600 text-white text-xs font-bold px-3 py-2 rounded-lg hover:bg-emerald-700 transition shadow-sm"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add My Task
                      </button>
                    </div>
                    {projectTasks.length === 0 ? (
                      <div className="bg-slate-50 border rounded-lg p-6 text-center text-slate-500 italic">
                        No tasks yet. Click &quot;Add My Task&quot; to organize your work.
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
                              {task.brief && <p className="text-xs text-slate-600 mb-1">{task.brief}</p>}
                              {task.agent && !isSelfManaged && (
                                <p className="text-xs text-slate-500">Assigned to: {task.agent.name} ({task.agent.role.replace(/_/g, " ")})</p>
                              )}
                              {task.deadline && (
                                <p className={`text-xs mt-1 font-medium ${new Date(task.deadline) < now ? "text-red-600" : "text-slate-500"}`}>
                                  Deadline: {new Date(task.deadline).toLocaleDateString()}
                                  {new Date(task.deadline) < now && task.status !== "done" && " ⚠️ OVERDUE"}
                                </p>
                              )}
                            </div>
                            <div className="mt-3 md:mt-0 flex items-center gap-3">
                              <select 
                                value={task.status}
                                onChange={(e) => handleUpdateTaskStatus(task.id, e.target.value)}
                                className="border-2 border-slate-200 rounded-lg text-sm font-bold px-3 py-1.5 focus:border-indigo-500 outline-none bg-white"
                              >
                                <option value="pending">{t("status.pendingOnHold")}</option>
                                <option value="in_progress">{t("status.inProgress")}</option>
                                <option value="review">{t("status.inReview")}</option>
                                <option value="done">{t("status.done")}</option>
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
                  </div>
                </div>
              )}

              {/* Agent View: Show Tasks */}
              {isAgent && (
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider">{t("task.mine")}</h4>
                    <button
                      onClick={() => setSelfTaskProject(project.id)}
                      className="inline-flex items-center gap-1.5 bg-emerald-600 text-white text-xs font-bold px-3 py-2 rounded-lg hover:bg-emerald-700 transition shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add My Task
                    </button>
                  </div>
                  {!projectTasks || projectTasks.length === 0 ? (
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
                                <option value="pending">{t("status.pendingOnHold")}</option>
                                <option value="in_progress">{t("status.inProgress")}</option>
                                <option value="review">{t("common.submitForReview")}</option>
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
                      <h3 className="font-bold text-lg text-slate-800">{t("task.requestCrossTeam")}</h3>
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

              {/* Content Task → Head SEO Modal */}
              {contentTaskProject === project.id && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                  <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
                    <div className="p-4 border-b bg-sky-50 flex justify-between items-center">
                      <div>
                        <h3 className="font-bold text-lg text-slate-800">Send Content SEO Task</h3>
                        <p className="text-xs text-slate-500 mt-0.5">Goes to the Head SEO, who assigns it to a content agent.</p>
                      </div>
                      <button onClick={() => setContentTaskProject(null)} className="text-slate-400 hover:text-slate-600 font-bold">&times;</button>
                    </div>
                    <div className="p-6">
                      <CrossTeamTaskForm projectId={project.id} userRole={userRole} lockedTaskType="content_seo" onClose={() => {
                        setContentTaskProject(null);
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
            <h2 className="text-lg font-bold text-slate-800">{t("task.myOverview")}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-start text-xs font-semibold text-slate-500 uppercase">{t("common.client")}</th>
                  <th className="px-6 py-3 text-start text-xs font-semibold text-slate-500 uppercase">{t("task.type")}</th>
                  <th className="px-6 py-3 text-start text-xs font-semibold text-slate-500 uppercase">{t("task.brief")}</th>
                  <th className="px-6 py-3 text-start text-xs font-semibold text-slate-500 uppercase">{t("task.deadline")}</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase">{t("common.status")}</th>
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
