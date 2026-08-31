import { useTranslator } from "@/components/i18n/LocaleProvider";
type TeamMember = {
  id: string;
  name: string;
  role: string;
};

type TeamGridRow = {
  department: string;
  leader: string | null;
  agent: string | null;
  status: string;
  taskCount: number;
  taskId?: string;
  leaderId: string | null;
  agentId: string | null;
};

type TeamProjectInfo = {
  accountManager?: { name?: string | null } | null;
  assignedAt?: string | Date | null;
};

type ClientTeamTabProps = {
  teamGrid: TeamGridRow[];
  project: TeamProjectInfo;
  teamMembers: TeamMember[];
  canManageTeamSlot: (department: string, roleType: "leader" | "agent") => boolean;
  handleTeamAssignment: (department: string, roleType: "leader" | "agent", newUserId: string) => void;
};

const deptRoleMap: Record<string, { leaders: string[]; agents: string[] }> = {
  SEO: {
    leaders: ["team_leader_seo"],
    agents: ["agent_seo", "agent_content_seo"],
  },
  "Social Media": {
    leaders: ["team_leader_social_media"],
    agents: ["agent_social_media"],
  },
  "Media Buyer": {
    leaders: ["team_leader_media_buyer"],
    agents: ["agent_media_buyer"],
  },
  "Graphic Design": {
    leaders: ["leader_graphic_designer"],
    agents: ["agent_graphic_designer"],
  },
  "Motion Graphics": {
    leaders: ["leader_motion_graphic"],
    agents: ["agent_motion_graphic"],
  },
  "UI/UX Design": {
    leaders: ["leader_ui"],
    agents: ["agent_ui"],
  },
};

export default function ClientTeamTab({
  teamGrid,
  project,
  teamMembers,
  canManageTeamSlot,
  handleTeamAssignment,
}: ClientTeamTabProps) {
  const t = useTranslator();
  return (
    <div className="bg-white rounded-xl border shadow-sm p-6">
      <h2 className="text-lg font-bold text-slate-800 mb-4">{t("journey.teamAssignment")}</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-start text-xs font-semibold text-slate-500 uppercase">{t("common.department")}</th>
              <th className="px-6 py-3 text-start text-xs font-semibold text-slate-500 uppercase">{t("journey.leader")}</th>
              <th className="px-6 py-3 text-start text-xs font-semibold text-slate-500 uppercase">{t("common.agent")}</th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase">{t("team.tasks")}</th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase">{t("common.status")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {teamGrid.map((row) => {
              const canAssignLeader = canManageTeamSlot(row.department, "leader");
              const canAssignAgent = canManageTeamSlot(row.department, "agent");
              const deptRoles = deptRoleMap[row.department] || { leaders: [], agents: [] };
              const leaders = teamMembers.filter((user) => deptRoles.leaders.includes(user.role));
              const agents = teamMembers.filter((user) => deptRoles.agents.includes(user.role));

              return (
                <tr key={row.department} className="hover:bg-slate-50/50">
                  <td className="px-6 py-4 text-sm font-bold text-slate-800">{row.department}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {canAssignLeader ? (
                      <select
                        key={`leader-${row.department}-${row.leaderId || "none"}`}
                        onChange={(event) => handleTeamAssignment(row.department, "leader", event.target.value)}
                        className="bg-slate-50 border rounded text-xs px-2 py-1 max-w-[150px]"
                        defaultValue={row.leaderId || ""}
                      >
                        <option value="" disabled>{t("journey.assignLeader")}</option>
                        {leaders.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
                      </select>
                    ) : (
                      row.leader || "—"
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {canAssignAgent ? (
                      <select
                        key={`agent-${row.department}-${row.agentId || "none"}`}
                        onChange={(event) => handleTeamAssignment(row.department, "agent", event.target.value)}
                        className="bg-slate-50 border rounded text-xs px-2 py-1 max-w-[150px]"
                        defaultValue={row.agentId || ""}
                      >
                        <option value="" disabled>{t("journey.assignAgent")}</option>
                        {agents.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
                      </select>
                    ) : (
                      row.agent || "—"
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-center font-medium">{row.taskCount}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold capitalize ${row.status === "done" ? "bg-emerald-100 text-emerald-700" : row.status === "in_progress" ? "bg-amber-100 text-amber-700" : row.status === "pending" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"}`}>
                      {row.status === "N/A" ? "No Tasks" : row.status.replace(/_/g, " ")}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-4 pt-4 border-t flex items-center gap-4 text-sm text-slate-500">
        <span>Account Manager: <strong className="text-slate-800">{project.accountManager?.name || "N/A"}</strong></span>
        <span>•</span>
        <span>Assigned: {project.assignedAt ? new Date(project.assignedAt).toLocaleDateString() : "N/A"}</span>
      </div>
    </div>
  );
}
