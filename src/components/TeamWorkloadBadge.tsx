import React from "react";
import { useTranslator } from "@/components/i18n/LocaleProvider";

export default function TeamWorkloadBadge({
  department,
  leader,
  agentCount,
  hasDelayedTasks,
}: {
  department: string;
  leader: { name: string } | null;
  agentCount: number;
  hasDelayedTasks: boolean;
}) {
  const t = useTranslator();
  const shortDept =
    department === "social_media"
      ? "SMM"
      : department === "media_buyer"
      ? "Media"
      : department === "seo"
      ? "SEO"
      : department === "content_seo"
      ? "Cont SEO"
      : department === "graphic_design"
      ? "GD"
      : department === "motion_graphic"
      ? "Motion"
      : department === "ui_design"
      ? "UI/UX"
      : department.substring(0, 4).toUpperCase();

  return (
    <div className="flex items-center gap-2 bg-slate-50 border rounded p-1.5 min-w-[120px]">
      <div className="flex-1">
        <div className="flex items-center gap-1">
          <span className="font-bold text-slate-700 uppercase" style={{ fontSize: "10px" }}>
            {shortDept}
          </span>
          {hasDelayedTasks && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>}
        </div>
        <div className="text-slate-500 truncate" style={{ fontSize: "11px", maxWidth: "100px" }}>
          {leader ? leader.name : <span className="text-red-400 italic font-medium">{t("team.assignLeader")}</span>}
        </div>
      </div>
      {agentCount > 0 && (
        <span className="bg-slate-200 text-slate-600 text-[9px] font-bold px-1.5 py-0.5 rounded-full">
          {agentCount}
        </span>
      )}
    </div>
  );
}
