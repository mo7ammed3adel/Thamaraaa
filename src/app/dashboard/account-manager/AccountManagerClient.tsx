"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, AlertTriangle, ListTodo, Clock, CheckCircle } from "lucide-react";

export default function AccountManagerClient({ userId, projects, kpis }: any) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredProjects = projects.filter((p: any) => {
    return !searchQuery || (p.deal?.lead?.name?.toLowerCase().includes(searchQuery.toLowerCase()) || p.deal?.lead?.phone?.includes(searchQuery));
  });

  const getProgressColor = (val: number) => val < 30 ? "bg-red-500" : val < 70 ? "bg-amber-400" : "bg-emerald-500";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">My Clients Dashboard</h1>
        <p className="text-sm text-slate-500">Welcome back. Here is the overview of your assigned projects.</p>
      </div>

      {/* ── KPI Grid ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl border bg-blue-50 border-blue-200 text-blue-900">
          <div className="flex justify-between items-start">
            <p className="text-sm font-medium opacity-80">Active Clients</p>
            <Briefcase className="w-5 h-5 opacity-50" />
          </div>
          <p className="text-3xl font-bold mt-1">{kpis.activeClients}</p>
        </div>
        
        <div className="p-5 rounded-2xl border bg-amber-50 border-amber-200 text-amber-900">
          <div className="flex justify-between items-start">
            <p className="text-sm font-medium opacity-80">Tasks In Progress</p>
            <ListTodo className="w-5 h-5 opacity-50" />
          </div>
          <p className="text-3xl font-bold mt-1">{kpis.tasksInProgress}</p>
        </div>

        <div className="p-5 rounded-2xl border bg-red-50 border-red-200 text-red-900">
          <div className="flex justify-between items-start">
            <p className="text-sm font-medium opacity-80">Delayed Tasks</p>
            <Clock className="w-5 h-5 opacity-50" />
          </div>
          <p className="text-3xl font-bold mt-1">{kpis.tasksDelayed}</p>
        </div>

        <div className="p-5 rounded-2xl border bg-emerald-50 border-emerald-200 text-emerald-900">
          <div className="flex justify-between items-start">
            <p className="text-sm font-medium opacity-80">Tasks Done This Week</p>
            <CheckCircle className="w-5 h-5 opacity-50" />
          </div>
          <p className="text-3xl font-bold mt-1">{kpis.tasksDoneThisWeek}</p>
        </div>
      </div>

      {/* ── My Clients List ── */}
      <div className="bg-white rounded-xl shadow border overflow-hidden">
        <div className="p-4 border-b bg-slate-50 flex gap-4 items-center">
          <h2 className="text-lg font-bold text-slate-800 whitespace-nowrap">My Clients</h2>
          <input 
            type="text" 
            placeholder="Search by client name or phone..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="flex-1 max-w-sm border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase">
              <tr>
                <th className="px-6 py-3 text-left">Client Info</th>
                <th className="px-6 py-3 text-left">Start Date</th>
                <th className="px-6 py-3 text-left">Technical Progress</th>
                <th className="px-6 py-3 text-center">Status</th>
                <th className="px-6 py-3 text-center">Tasks</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredProjects.map((p: any) => {
                const activeTasks = p.tasks?.filter((t:any) => t.status !== "done").length || 0;
                
                return (
                  <tr key={p.id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900">{p.deal?.lead?.name}</div>
                      <div className="text-xs text-slate-500 mt-1 uppercase font-medium bg-slate-100 w-fit px-2 py-0.5 rounded">{p.package}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-slate-700">
                        {p.deal?.contractStart ? new Date(p.deal.contractStart).toLocaleDateString() : "Pending"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="w-48 space-y-1">
                        {[{ label: "SEO", val: p.seoProgress }, { label: "SMM", val: p.socialMediaProgress }, { label: "Media", val: p.mediaBuyerProgress }].map((b) => (
                          <div key={b.label} className="flex items-center text-[10px]">
                            <span className="w-8 font-bold text-slate-400">{b.label}</span>
                            <div className="flex-1 bg-slate-100 h-1 mx-2 rounded-full overflow-hidden">
                              <div className={`${getProgressColor(b.val)} h-1`} style={{ width: `${b.val}%` }} />
                            </div>
                            <span className="w-6 text-right font-bold text-slate-600">{b.val.toFixed(0)}%</span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-0.5 text-xs font-bold rounded capitalize border ${
                        p.projectStatus === "completed" ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                        : p.projectStatus === "delayed" ? "bg-red-50 text-red-700 border-red-200" 
                        : p.projectStatus === "in_progress" ? "bg-blue-50 text-blue-700 border-blue-200" 
                        : p.projectStatus === "new" ? "bg-purple-50 text-purple-700 border-purple-200" 
                        : "bg-slate-50 text-slate-700 border-slate-200"
                      }`}>
                        {p.projectStatus.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {activeTasks > 0 ? (
                        <span className="inline-flex items-center justify-center bg-blue-100 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-full">
                          {activeTasks} Active
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 font-medium">None</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => router.push(`/dashboard/clients/${p.id}`)} 
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 shadow-sm transition inline-flex items-center gap-2"
                      >
                        Client Portal <span>→</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredProjects.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-400 italic">
                    {searchQuery ? "No matched clients found." : "You have no clients assigned yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
