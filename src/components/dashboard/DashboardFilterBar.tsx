import type { ReactNode } from "react";

type DashboardFilterBarProps = {
  children: ReactNode;
  actions?: ReactNode;
};

export default function DashboardFilterBar({ children, actions }: DashboardFilterBarProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-wrap gap-4 items-end">
      <div className="flex flex-wrap gap-4 items-end flex-1 min-w-0">{children}</div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
