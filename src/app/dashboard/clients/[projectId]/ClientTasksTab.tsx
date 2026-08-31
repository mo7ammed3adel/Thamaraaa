import type { Dispatch, SetStateAction } from "react";
import { useTranslator } from "@/components/i18n/LocaleProvider";

type TeamMember = {
  id: string;
  name: string;
  role: string;
};

type ClientTask = {
  id: string;
  taskType: string;
  status: string;
  priority?: string | null;
  createdAt: string | Date;
  completedAt?: string | Date | null;
  leaderId?: string | null;
  agentId?: string | null;
  leader?: TeamMember | null;
  agent?: TeamMember | null;
  brief?: string | null;
  taskLink?: string | null;
  progressPct?: number | null;
  subTasks?: ClientTask[];
};

type ClientTasksProject = {
  tasks?: ClientTask[];
};

type ClientTasksTabProps = {
  project: ClientTasksProject;
  teamMembers: TeamMember[];
  userId: string;
  isAdmin: boolean;
  newTaskType: string;
  setNewTaskType: Dispatch<SetStateAction<string>>;
  newTaskBrief: string;
  setNewTaskBrief: Dispatch<SetStateAction<string>>;
  newTaskPriority: string;
  setNewTaskPriority: Dispatch<SetStateAction<string>>;
  newTaskDeadline: string;
  setNewTaskDeadline: Dispatch<SetStateAction<string>>;
  newTaskLink: string;
  setNewTaskLink: Dispatch<SetStateAction<string>>;
  creatingTask: boolean;
  handleCreateTask: () => void;
  taskFilterTeam: string;
  setTaskFilterTeam: Dispatch<SetStateAction<string>>;
  taskFilterStatus: string;
  setTaskFilterStatus: Dispatch<SetStateAction<string>>;
  taskFilterCreator: string;
  setTaskFilterCreator: Dispatch<SetStateAction<string>>;
  handleAssignUser: (taskId: string, field: "leaderId" | "agentId", newValue: string) => void;
  handleUpdateStatus: (taskId: string, status: string) => void;
  handleUpdateProgress: (taskId: string, progressPct: number) => void;
};

const taskTypeRoleMap: Record<string, { leaders: string[]; agents: string[] }> = {
  SEO: { leaders: ["team_leader_seo"], agents: ["agent_seo", "agent_content_seo"] },
  seo: { leaders: ["team_leader_seo"], agents: ["agent_seo", "agent_content_seo"] },
  content_seo: { leaders: ["team_leader_seo"], agents: ["agent_seo", "agent_content_seo"] },
  Social_Media: { leaders: ["team_leader_social_media"], agents: ["agent_social_media"] },
  social_media: { leaders: ["team_leader_social_media"], agents: ["agent_social_media"] },
  Media_Buyer: { leaders: ["team_leader_media_buyer"], agents: ["agent_media_buyer"] },
  media_buyer: { leaders: ["team_leader_media_buyer"], agents: ["agent_media_buyer"] },
  media_buying: { leaders: ["team_leader_media_buyer"], agents: ["agent_media_buyer"] },
  graphic_design: { leaders: ["leader_graphic_designer"], agents: ["agent_graphic_designer"] },
  motion_graphic: { leaders: ["leader_motion_graphic"], agents: ["agent_motion_graphic"] },
  ui_design: { leaders: ["leader_ui"], agents: ["agent_ui"] },
  technical: { leaders: ["head_technical"], agents: ["agent_technical"] },
};

function filterTasks(tasks: ClientTask[], team: string, status: string, creator: string) {
  return tasks.filter((task) => {
    if (team !== "all" && task.taskType !== team) return false;
    if (status !== "all" && task.status !== status) return false;
    if (creator !== "all" && task.leaderId !== creator) return false;
    return true;
  });
}

export default function ClientTasksTab({
  project,
  teamMembers,
  userId,
  isAdmin,
  newTaskType,
  setNewTaskType,
  newTaskBrief,
  setNewTaskBrief,
  newTaskPriority,
  setNewTaskPriority,
  newTaskDeadline,
  setNewTaskDeadline,
  newTaskLink,
  setNewTaskLink,
  creatingTask,
  handleCreateTask,
  taskFilterTeam,
  setTaskFilterTeam,
  taskFilterStatus,
  setTaskFilterStatus,
  taskFilterCreator,
  setTaskFilterCreator,
  handleAssignUser,
  handleUpdateStatus,
  handleUpdateProgress,
}: ClientTasksTabProps) {
  const t = useTranslator();
  const tasks = project.tasks || [];
  const filteredTasks = filterTasks(tasks, taskFilterTeam, taskFilterStatus, taskFilterCreator);
  const hasFilters = taskFilterTeam !== "all" || taskFilterStatus !== "all" || taskFilterCreator !== "all";
  const resetFilters = () => {
    setTaskFilterTeam("all");
    setTaskFilterStatus("all");
    setTaskFilterCreator("all");
  };
  const creators = Array.from(
    new Map(
      tasks
        .filter((task) => task.leader && task.leaderId)
        .map((task) => [task.leaderId as string, task.leader?.name || ""])
    ).entries()
  );

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border shadow-sm p-6">
        <h2 className="text-lg font-bold text-slate-800 mb-3">{t("task.assignNew")}</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
          <select value={newTaskType} onChange={(e) => setNewTaskType(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white">
            <option value="seo">{t("team.seo")}</option>
            <option value="content_seo">{t("team.contentSeo")}</option>
            <option value="social_media">{t("team.socialMedia")}</option>
            <option value="media_buyer">{t("team.mediaBuyer")}</option>
            <option value="graphic_design">{t("team.graphicDesign")}</option>
            <option value="motion_graphic">{t("team.motionGraphic")}</option>
            <option value="ui_design">{t("team.uiUx")}</option>
            <option value="technical">{t("team.technicalWeb")}</option>
          </select>
          <select value={newTaskPriority} onChange={(e) => setNewTaskPriority(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white">
            <option value="Low">Low Priority</option>
            <option value="Medium">Medium Priority</option>
            <option value="High">High Priority</option>
          </select>
          <input type="date" value={newTaskDeadline} onChange={(e) => setNewTaskDeadline(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white" />
        </div>
        <div className="space-y-3">
          <textarea value={newTaskBrief} onChange={(e) => setNewTaskBrief(e.target.value)} placeholder="Task details and instructions..." className="w-full border rounded-lg px-3 py-2 text-sm resize-none h-20" />
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔗</div>
              <input
                type="url"
                value={newTaskLink}
                onChange={(e) => setNewTaskLink(e.target.value)}
                placeholder="Paste link here (Google Drive, Sheets, etc.)..."
                className="w-full border rounded-lg ps-8 pe-3 py-2 text-sm bg-white focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 transition"
              />
            </div>
            <button onClick={handleCreateTask} disabled={!newTaskBrief.trim() || creatingTask} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition whitespace-nowrap">
              {creatingTask ? "Sending..." : "Create Task"}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border shadow-sm p-6">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <h2 className="text-lg font-bold text-slate-800">Tasks & Tracking</h2>
          <span className="text-xs text-slate-400 font-medium">
            Showing {filteredTasks.length} of {tasks.length} tasks
          </span>
        </div>

        <div className="flex flex-wrap gap-3 mb-5 p-3 bg-slate-50 rounded-xl border border-slate-100">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Team</label>
            <select value={taskFilterTeam} onChange={(e) => setTaskFilterTeam(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white min-w-[140px] focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 transition">
              <option value="all">{t("filter.allTeams")}</option>
              <option value="seo">{t("team.seo")}</option>
              <option value="content_seo">{t("team.contentSeo")}</option>
              <option value="social_media">{t("team.socialMedia")}</option>
              <option value="media_buyer">{t("team.mediaBuyer")}</option>
              <option value="graphic_design">{t("team.graphicDesign")}</option>
              <option value="motion_graphic">{t("team.motionGraphic")}</option>
              <option value="ui_design">{t("team.uiUx")}</option>
              <option value="technical">{t("team.technicalWeb")}</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{t("common.status")}</label>
            <select value={taskFilterStatus} onChange={(e) => setTaskFilterStatus(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white min-w-[130px] focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 transition">
              <option value="all">{t("filter.allStatuses")}</option>
              <option value="pending">{t("status.pending")}</option>
              <option value="in_progress">{t("status.inProgress")}</option>
              <option value="review">{t("status.inReview")}</option>
              <option value="done">{t("status.done")}</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Assigned By</label>
            <select value={taskFilterCreator} onChange={(e) => setTaskFilterCreator(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white min-w-[140px] focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 transition">
              <option value="all">All Creators</option>
              {creators.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </div>

          {hasFilters && (
            <div className="flex items-end">
              <button onClick={resetFilters} className="px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition">
                ✕ Reset Filters
              </button>
            </div>
          )}
        </div>

        {tasks.length === 0 ? (
          <p className="text-sm text-slate-400 italic py-4">No tasks created yet.</p>
        ) : (
          <div className="space-y-3">
            {filteredTasks.map((task) => {
              const isTaskLeader = task.leaderId === userId;
              const taskCanAssignLeader = isAdmin;
              const taskCanAssignAgent = isAdmin || isTaskLeader;
              const roles = taskTypeRoleMap[task.taskType] || { leaders: [], agents: [] };
              const taskLeaders = teamMembers.filter((user) => roles.leaders.includes(user.role));
              const taskAgents = teamMembers.filter((user) => roles.agents.includes(user.role));
              const canUpdateTask = isAdmin || isTaskLeader || task.agentId === userId;
              const isSelfManaged = task.leaderId && task.agentId && task.leaderId === task.agentId;
              const progressPct = task.progressPct ?? 0;

              return (
                <div key={task.id} className="border rounded-lg p-4 hover:shadow-sm transition">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-800 capitalize">{task.taskType.replace(/_/g, " ")}</span>
                      <span className={`px-2 py-0.5 text-xs font-bold rounded ${task.status === "done" ? "bg-emerald-100 text-emerald-700" : task.status === "in_progress" ? "bg-amber-100 text-amber-700" : task.status === "review" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>{task.status}</span>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${task.priority === "High" ? "bg-red-100 text-red-700" : task.priority === "Low" ? "bg-slate-100 text-slate-500" : "bg-amber-100 text-amber-600"}`}>{task.priority}</span>
                      {isSelfManaged && (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-50 text-emerald-600 border border-emerald-200 uppercase tracking-wide">🔓 Self-Managed</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-slate-400">
                        Created: {new Date(task.createdAt).toLocaleDateString()} {task.completedAt && `• Completed: ${new Date(task.completedAt).toLocaleDateString()}`}
                      </span>
                      {canUpdateTask && task.status !== "done" && (
                        <div className="flex gap-1">
                          {task.status === "pending" && (
                            <button onClick={() => handleUpdateStatus(task.id, "in_progress")} className="px-3 py-1 bg-amber-100 text-amber-700 rounded-lg text-xs font-bold hover:bg-amber-200 transition">▶ Start</button>
                          )}
                          {task.status === "in_progress" && (
                            <button onClick={() => handleUpdateStatus(task.id, "review")} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-bold hover:bg-blue-200 transition">📋 Review</button>
                          )}
                          {task.status === "review" && (
                            <button onClick={() => handleUpdateStatus(task.id, "done")} className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold hover:bg-emerald-200 transition">✓ Done</button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-6 mt-2 text-xs text-slate-500 flex-wrap items-center">
                    <span className="flex items-center gap-2">
                      Assigned By:
                      {taskCanAssignLeader ? (
                        <select onChange={(e) => handleAssignUser(task.id, "leaderId", e.target.value)} className="bg-slate-50 border rounded px-1 py-0.5 max-w-[120px]" defaultValue="">
                          <option value="" disabled>{task.leader?.name || "Unassigned"}</option>
                          {taskLeaders.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
                        </select>
                      ) : (
                        <strong>{task.leader?.name || "—"}</strong>
                      )}
                    </span>
                    <span className="flex items-center gap-2">
                      Assigned To:
                      {taskCanAssignAgent ? (
                        <select onChange={(e) => handleAssignUser(task.id, "agentId", e.target.value)} className="bg-slate-50 border rounded px-1 py-0.5 max-w-[120px]" defaultValue="">
                          <option value="" disabled>{task.agent?.name || "Unassigned"}</option>
                          {taskAgents.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
                        </select>
                      ) : (
                        <strong>{task.agent?.name || "Unassigned"}</strong>
                      )}
                    </span>
                    {task.brief && <span>Brief: {task.brief}</span>}
                    {task.taskLink && (
                      <a href={task.taskLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 hover:underline font-medium">
                        🔗 Link
                      </a>
                    )}
                  </div>

                  {canUpdateTask && task.status !== "done" ? (
                    <div className="mt-3 flex items-center gap-3">
                      <span className="text-xs font-semibold text-slate-500 w-16">{t("sales.progress")}</span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        defaultValue={progressPct}
                        onMouseUp={(event) => handleUpdateProgress(task.id, Number((event.target as HTMLInputElement).value))}
                        onTouchEnd={(event) => handleUpdateProgress(task.id, Number((event.target as HTMLInputElement).value))}
                        className="flex-1 h-2 accent-indigo-600 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-indigo-600 w-10 text-end">{progressPct}%</span>
                    </div>
                  ) : (
                    <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
                      <div className="bg-indigo-500 h-1.5 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
                    </div>
                  )}

                  {task.subTasks && task.subTasks.length > 0 && (
                    <div className="mt-2 ps-4 border-s-2 border-indigo-200 space-y-1">
                      {task.subTasks.map((subTask) => (
                        <div key={subTask.id} className="flex items-center justify-between text-xs text-slate-500 py-1">
                          <span>↳ {subTask.taskType.replace(/_/g, " ")}: <strong>{subTask.status}</strong> ({subTask.progressPct ?? 0}%)</span>
                          <span>{subTask.agent?.name || "Unassigned"}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {filteredTasks.length === 0 && (
              <div className="text-center py-8">
                <p className="text-sm text-slate-400 italic">No tasks match the selected filters.</p>
                <button onClick={resetFilters} className="mt-2 text-xs text-indigo-600 hover:underline font-medium">
                  Clear all filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
