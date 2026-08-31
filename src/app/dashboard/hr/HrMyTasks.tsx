"use client";

import { useEffect, useState } from "react";
import { ListTodo, Loader2, CalendarClock, Flag } from "lucide-react";
import { listTasks } from "@/client/api/tasks";
import { useTranslator } from "@/components/i18n/LocaleProvider";

type Task = {
  id: string;
  taskType: string;
  brief?: string | null;
  status: string;
  priority: string;
  deadline?: string | null;
  progressPct?: number;
};

const STATUS_TONE: Record<string, string> = {
  pending: "bg-slate-100 text-slate-600",
  in_progress: "bg-blue-100 text-blue-700",
  review: "bg-amber-100 text-amber-700",
  done: "bg-emerald-100 text-emerald-700",
};

const PRIORITY_TONE: Record<string, string> = {
  High: "text-rose-600",
  Medium: "text-amber-600",
  Low: "text-slate-500",
};

function prettyStatus(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Employee "My Tasks" panel — lists project tasks assigned to the current user
 * (as leader/agent/team member). Hidden entirely for roles that have no tasks,
 * so it never clutters the page for sales/finance/etc.
 */
export default function HrMyTasks() {
  const t = useTranslator();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    listTasks()
      .then((res: any) => {
        if (active) setTasks(Array.isArray(res?.tasks) ? res.tasks : []);
      })
      .catch(() => {
        if (active) setTasks([]);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  // Only the work that isn't finished yet is relevant on the self-service page.
  const open = tasks.filter((t) => t.status !== "done");

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading your tasks…
      </div>
    );
  }

  // Nothing assigned → don't render the card at all.
  if (open.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
        <span className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
          <ListTodo className="w-4 h-4" />
        </span>
        <h2 className="font-bold text-slate-800">{t("task.mine")}</h2>
        <span className="ms-auto text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
          {open.length}
        </span>
      </div>
      <div className="divide-y divide-slate-50">
        {open.map((t) => {
          const overdue = t.deadline && new Date(t.deadline) < new Date() && t.status !== "done";
          return (
            <div key={t.id} className="px-6 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800 text-sm">{prettyStatus(t.taskType)}</p>
                  {t.brief && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{t.brief}</p>}
                </div>
                <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-1 ${STATUS_TONE[t.status] || STATUS_TONE.pending}`}>
                  {prettyStatus(t.status)}
                </span>
              </div>
              <div className="flex items-center gap-4 mt-2 text-[11px] font-semibold">
                <span className={`flex items-center gap-1 ${PRIORITY_TONE[t.priority] || "text-slate-500"}`}>
                  <Flag className="w-3 h-3" /> {t.priority}
                </span>
                {t.deadline && (
                  <span className={`flex items-center gap-1 ${overdue ? "text-rose-600" : "text-slate-500"}`}>
                    <CalendarClock className="w-3 h-3" />
                    {new Date(t.deadline).toLocaleDateString()}
                    {overdue && " · Overdue"}
                  </span>
                )}
                <span className="ms-auto text-slate-400">{Math.round(t.progressPct || 0)}%</span>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-indigo-500 transition-all"
                  style={{ width: `${Math.min(100, Math.max(0, t.progressPct || 0))}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
