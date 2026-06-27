import type { ReactNode } from "react";

type BadgeTone = "slate" | "blue" | "green" | "emerald" | "amber" | "orange" | "red" | "purple";

const toneClasses: Record<BadgeTone, string> = {
  slate: "bg-slate-100 text-slate-700 border-slate-200",
  blue: "bg-blue-100 text-blue-700 border-blue-200",
  green: "bg-green-100 text-green-700 border-green-200",
  emerald: "bg-emerald-100 text-emerald-700 border-emerald-200",
  amber: "bg-amber-100 text-amber-700 border-amber-200",
  orange: "bg-orange-100 text-orange-700 border-orange-200",
  red: "bg-red-100 text-red-700 border-red-200",
  purple: "bg-purple-100 text-purple-700 border-purple-200",
};

type DashboardStatusBadgeProps = {
  children: ReactNode;
  tone?: BadgeTone;
};

export default function DashboardStatusBadge({ children, tone = "slate" }: DashboardStatusBadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${toneClasses[tone]}`}>
      {children}
    </span>
  );
}
