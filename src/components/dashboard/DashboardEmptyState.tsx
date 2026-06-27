import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

type DashboardEmptyStateProps = {
  title: string;
  description?: ReactNode;
  icon?: LucideIcon;
  action?: ReactNode;
};

export default function DashboardEmptyState({ title, description, icon: Icon, action }: DashboardEmptyStateProps) {
  return (
    <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-10 text-center text-gray-500">
      {Icon && (
        <div className="mx-auto mb-3 h-10 w-10 rounded-full bg-white border border-gray-200 flex items-center justify-center">
          <Icon className="h-5 w-5 text-gray-400" />
        </div>
      )}
      <p className="text-sm font-semibold text-gray-700">{title}</p>
      {description && <div className="text-sm text-gray-500 mt-1">{description}</div>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
