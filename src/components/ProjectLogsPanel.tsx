"use client";

import { Clock, Info, CheckCircle, ArrowRight, UserPlus, FileText, AlertTriangle } from "lucide-react";

export default function ProjectLogsPanel({ logs }: { logs: any[] }) {
  if (!logs || logs.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-xl border border-dashed">
        <p className="font-medium">No activity recorded yet</p>
      </div>
    );
  }

  const formatRelTime = (dateString: string) => {
    const d = new Date(dateString).getTime();
    const now = Date.now();
    const diff = now - d;
    
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff/60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff/3600000)}h ago`;
    return `${Math.floor(diff/86400000)}d ago`;
  };

  const getLogStyle = (action: string) => {
    switch (action) {
      case "lifecycle_changed": return { icon: ArrowRight, color: "text-blue-600", bg: "bg-blue-100" };
      case "team_assigned": return { icon: UserPlus, color: "text-violet-600", bg: "bg-violet-100" };
      case "task_created": return { icon: FileText, color: "text-amber-600", bg: "bg-amber-100" };
      case "progress_updated": return { icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-100" };
      case "warning_created": return { icon: AlertTriangle, color: "text-red-600", bg: "bg-red-100" };
      default: return { icon: Info, color: "text-slate-600", bg: "bg-slate-100" };
    }
  };

  const formatDetails = (action: string, details: string) => {
    try {
      if (details.startsWith("{") || details.startsWith("[")) {
         const parsed = JSON.parse(details);
         return parsed.description || JSON.stringify(parsed);
      }
      return details;
    } catch {
      return details;
    }
  };

  return (
    <div className="space-y-4 relative before:absolute before:inset-0 before:ms-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
      {logs.map((log, i) => {
        const style = getLogStyle(log.action);
        const Icon = style.icon;
        
        return (
          <div key={log.id || i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
            <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-white ${style.bg} ${style.color} shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 relative z-10 ms-0 md:ms-auto md:me-auto`}>
              <Icon className="w-4 h-4" />
            </div>
            
            <div className="w-[calc(100%-3rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border bg-white shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between mb-1">
                <div className="font-bold text-sm text-slate-800 capitalize">
                  {log.action.replace(/_/g, " ")}
                </div>
                <div className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatRelTime(log.createdAt)}
                </div>
              </div>
              <div className="text-sm text-slate-600 mb-2">
                {formatDetails(log.action, log.details)}
              </div>
              {log.user && (
                <div className="text-[10px] uppercase font-bold text-slate-500">
                  By: {log.user.name} ({log.user.role.replace(/_/g, " ")}) 
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
