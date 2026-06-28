"use client";

import { X } from "lucide-react";

import LifecycleStateBadge from "@/components/LifecycleStateBadge";

type HeadTechnicalTasksPanelProps = {
  allTasks: any[];
  visibleTasks: any[];
  projects: any[];
  taskFilter: string;
  setTaskFilter: (value: string) => void;
};

export default function HeadTechnicalTasksPanel({
  allTasks,
  visibleTasks,
  projects,
  taskFilter,
  setTaskFilter,
}: HeadTechnicalTasksPanelProps) {
  return (
    <div className="bg-white rounded-xl shadow border overflow-hidden">
      <div className="p-4 border-b bg-slate-50 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-slate-800">Global Tasks Execution</h2>
        <div className="flex items-center gap-3">
          <select value={taskFilter} onChange={(e) => setTaskFilter(e.target.value)} className="text-sm border rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="delayed">Delayed</option>
            <option value="done">Done</option>
          </select>
          {taskFilter !== "all" && (
            <button
              onClick={() => setTaskFilter("all")}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition"
            >
              <X className="w-3 h-3" /> Clear
            </button>
          )}
          <span className="text-xs text-slate-400">
            {visibleTasks.length} tasks
          </span>
        </div>
      </div>
      <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
        <table className="min-w-full divide-y divide-gray-200 relative">
          <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Target Client</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Task Type & Brief</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Assigned Leader</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Deadline</th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {visibleTasks.map((task: any) => {
              const isDelayed = task.status !== "done" && task.deadline && new Date(task.deadline) < new Date();
              const parentProject = projects.find((project:any) => project.id === task.projectId);
              return (
               <tr key={task.id} className="hover:bg-slate-50/50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="font-bold text-slate-900 text-sm">{parentProject?.deal?.lead?.name || "Unknown"}</div>
                      {parentProject?.lifecycleState && <LifecycleStateBadge state={parentProject.lifecycleState} />}
                    </div>
                    <div className="text-xs text-slate-500">Project: {parentProject?.package || "N/A"}</div>
                  </td>
                  <td className="px-6 py-4 line-clamp-2 max-w-xs">
                    <span className="font-bold text-[10px] uppercase bg-slate-100 px-2 py-0.5 rounded text-slate-600 mr-2">{task.taskType.replace(/_/g, " ")}</span>
                    <span className="text-sm text-slate-700">{task.brief}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-semibold text-slate-800">{task.leader?.name || "Not Assigned"}</div>
                    <div className="text-xs text-slate-500">{task.agent?.name ? `Agent: ${task.agent.name}` : "Pending Agent"}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className={`text-sm font-medium ${isDelayed ? "text-red-600" : "text-slate-600"}`}>
                      {task.deadline ? new Date(task.deadline).toLocaleDateString() : "No Deadline"}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2 py-0.5 text-[10px] rounded font-bold uppercase border ${task.status === "done" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : isDelayed ? "bg-red-50 text-red-700 border-red-200" : task.status === "in_progress" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-slate-50 text-slate-700 border-slate-200"}`}>
                      {isDelayed ? "DELAYED" : task.status.replace(/_/g, " ")}
                    </span>
                  </td>
               </tr>
              )
            })}
            {allTasks.length === 0 && (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-sm text-slate-400 italic">No operational tasks generated yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
