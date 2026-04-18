"use client";

import { Users, UserCheck } from "lucide-react";

interface TeamMember {
  id: string;
  name: string;
  role: string;
}

interface TeamDepartment {
  department: string;
  leader: TeamMember | null;
  agents: TeamMember[];
  taskCounts: { hold: number; inProgress: number; done: number; total: number };
  progressPercentage: number;
}

interface TeamOverviewProps {
  /** Array of department teams with members and task stats */
  teams: TeamDepartment[];
}

/** Department display names */
const DEPARTMENT_LABELS: Record<string, string> = {
  social_media: "Social Media",
  media_buyer: "Media Buyer",
  seo: "SEO",
  graphic_design: "Graphic Design",
  motion_graphic: "Motion Graphic",
  ui_design: "UI/UX Design",
  content_seo: "Content SEO",
};

/** Department colors for the card accent */
const DEPARTMENT_COLORS: Record<string, string> = {
  social_media: "border-l-pink-500",
  media_buyer: "border-l-indigo-500",
  seo: "border-l-orange-500",
  graphic_design: "border-l-teal-500",
  motion_graphic: "border-l-purple-500",
  ui_design: "border-l-cyan-500",
  content_seo: "border-l-amber-500",
};

/**
 * Renders a grid of department cards showing team leader, agent count,
 * task status breakdown, and progress.
 */
export default function TeamOverview({ teams }: TeamOverviewProps) {
  if (teams.length === 0) {
    return (
      <div className="text-sm text-gray-400 italic text-center py-6">
        No teams assigned yet.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {teams.map((team) => {
        const label = DEPARTMENT_LABELS[team.department] || team.department.replace(/_/g, " ");
        const accentColor = DEPARTMENT_COLORS[team.department] || "border-l-gray-400";
        const progressPct = team.taskCounts.total > 0
          ? Math.round((team.taskCounts.done / team.taskCounts.total) * 100)
          : 0;

        return (
          <div
            key={team.department}
            className={`border rounded-lg p-4 shadow-sm border-l-4 ${accentColor} bg-white`}
          >
            {/* Department Header */}
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-slate-800 capitalize">{label}</h4>
              <div className="flex items-center gap-1 text-xs text-slate-400">
                <Users className="h-3.5 w-3.5" />
                <span>{team.agents.length} agents</span>
              </div>
            </div>

            {/* Team Leader */}
            <div className="flex items-center gap-2 mb-3">
              <UserCheck className="h-4 w-4 text-slate-400" />
              {team.leader ? (
                <span className="text-sm font-medium text-slate-700">{team.leader.name}</span>
              ) : (
                <span className="text-sm text-slate-400 italic">Not assigned</span>
              )}
            </div>

            {/* Task Counts */}
            <div className="flex gap-2 mb-3">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                {team.taskCounts.hold} Hold
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                {team.taskCounts.inProgress} Active
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                {team.taskCounts.done} Done
              </span>
            </div>

            {/* Progress Bar */}
            <div>
              <div className="flex justify-between text-[10px] font-medium text-slate-500 mb-1">
                <span>Progress</span>
                <span>{progressPct}%</span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    progressPct >= 80 ? "bg-emerald-500" : progressPct >= 40 ? "bg-amber-400" : "bg-red-400"
                  }`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
