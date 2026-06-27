type UserRef = {
  id?: string | null;
  name?: string | null;
  role?: string | null;
};

type TaskRef = {
  id?: string | null;
  taskType: string;
  status?: string | null;
  leader?: UserRef | null;
  agent?: UserRef | null;
};

type TeamAssignmentRef = {
  department: string;
  user?: UserRef | null;
};

type ClientJourneyTeamProject = {
  tasks?: TaskRef[];
  teamAssignments?: TeamAssignmentRef[];
};

type DepartmentConfig = {
  name: string;
  types: string[];
  deptCodes: string[];
  leaderRoles: string[];
  agentRoles: string[];
};

export type ClientJourneyTeamGridRow = {
  department: string;
  leader: string | null;
  agent: string | null;
  status: string;
  taskCount: number;
  taskId?: string;
  leaderId: string | null;
  agentId: string | null;
};

const DEPARTMENTS: DepartmentConfig[] = [
  { name: "SEO", types: ["SEO", "seo", "content_seo"], deptCodes: ["seo", "content_seo"], leaderRoles: ["team_leader_seo"], agentRoles: ["agent_seo", "agent_content_seo"] },
  { name: "Social Media", types: ["Social_Media", "social_media"], deptCodes: ["social_media"], leaderRoles: ["team_leader_social_media"], agentRoles: ["agent_social_media"] },
  { name: "Media Buyer", types: ["Media_Buyer", "media_buyer", "media_buying"], deptCodes: ["media_buyer"], leaderRoles: ["team_leader_media_buyer"], agentRoles: ["agent_media_buyer"] },
  { name: "Graphic Design", types: ["graphic_design"], deptCodes: ["graphic_design"], leaderRoles: ["leader_graphic_designer"], agentRoles: ["agent_graphic_designer"] },
  { name: "Motion Graphics", types: ["motion_graphic"], deptCodes: ["motion_graphic"], leaderRoles: ["leader_motion_graphic"], agentRoles: ["agent_motion_graphic"] },
  { name: "UI/UX Design", types: ["ui_design"], deptCodes: ["ui_design"], leaderRoles: ["leader_ui"], agentRoles: ["agent_ui"] },
];

function getOverallStatus(statuses: Array<string | null | undefined>) {
  return statuses.includes("in_progress") ? "in_progress" : statuses.includes("pending") ? "pending" : statuses.includes("done") ? "done" : "N/A";
}

export function buildClientJourneyTeamGrid(project: ClientJourneyTeamProject): ClientJourneyTeamGridRow[] {
  const assignments = project.teamAssignments || [];

  return DEPARTMENTS.map((dept) => {
    const tasks = project.tasks?.filter((task) => dept.types.includes(task.taskType)) || [];

    let leaderName = tasks[0]?.leader?.name || null;
    let leaderId = tasks[0]?.leader?.id || null;
    let agentName = tasks[0]?.agent?.name || null;
    let agentId = tasks[0]?.agent?.id || null;

    const deptAssignments = assignments.filter((assignment) => dept.deptCodes.includes(assignment.department));
    for (const assignment of deptAssignments) {
      if (!leaderName && dept.leaderRoles.includes(assignment.user?.role || "")) {
        leaderName = assignment.user?.name || null;
        leaderId = assignment.user?.id || null;
      }
      if (!agentName && dept.agentRoles.includes(assignment.user?.role || "")) {
        agentName = assignment.user?.name || null;
        agentId = assignment.user?.id || null;
      }
    }

    const statuses = tasks.map((task) => task.status);

    return {
      department: dept.name,
      leader: leaderName,
      agent: agentName,
      status: getOverallStatus(statuses),
      taskCount: tasks.length,
      taskId: tasks[0]?.id || undefined,
      leaderId,
      agentId,
    };
  });
}
