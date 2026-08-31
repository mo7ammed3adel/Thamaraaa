import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

type KpiTone = "slate" | "blue" | "indigo" | "violet" | "green" | "emerald" | "amber" | "orange" | "red" | "cyan";

const toneClasses: Record<KpiTone, { card: string; icon: string; active: string }> = {
  slate: { card: "bg-slate-600 text-white", icon: "text-white/80", active: "ring-slate-300" },
  blue: { card: "bg-blue-600 text-white", icon: "text-white/80", active: "ring-blue-300" },
  indigo: { card: "bg-indigo-600 text-white", icon: "text-white/80", active: "ring-indigo-300" },
  violet: { card: "bg-violet-600 text-white", icon: "text-white/80", active: "ring-violet-300" },
  green: { card: "bg-green-600 text-white", icon: "text-white/80", active: "ring-green-300" },
  emerald: { card: "bg-emerald-600 text-white", icon: "text-white/80", active: "ring-emerald-300" },
  amber: { card: "bg-amber-500 text-white", icon: "text-white/80", active: "ring-amber-300" },
  orange: { card: "bg-orange-500 text-white", icon: "text-white/80", active: "ring-orange-300" },
  red: { card: "bg-red-600 text-white", icon: "text-white/80", active: "ring-red-300" },
  cyan: { card: "bg-cyan-600 text-white", icon: "text-white/80", active: "ring-cyan-300" },
};

type DashboardKpiCardProps = {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  tone?: KpiTone;
  active?: boolean;
  helper?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
};

export default function DashboardKpiCard({
  label,
  value,
  icon: Icon,
  tone = "slate",
  active = false,
  helper,
  trailing,
  onClick,
}: DashboardKpiCardProps) {
  const classes = toneClasses[tone];
  const interactive = Boolean(onClick);
  const Component = onClick ? "button" : "div";

  return (
    <Component
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`rounded-xl p-4 text-start shadow-lg transition-all ${classes.card} ${
        interactive ? "cursor-pointer hover:scale-[1.02]" : ""
      } ${active ? `ring-4 ${classes.active}` : ""}`}
    >
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          {Icon && <Icon className={`h-5 w-5 shrink-0 ${classes.icon}`} />}
          <span className="text-xs font-semibold uppercase opacity-80 truncate">{label}</span>
        </div>
        {trailing}
      </div>
      <p className="text-3xl font-bold leading-tight">{value}</p>
      {helper && <div className="text-xs opacity-75 mt-1">{helper}</div>}
    </Component>
  );
}
