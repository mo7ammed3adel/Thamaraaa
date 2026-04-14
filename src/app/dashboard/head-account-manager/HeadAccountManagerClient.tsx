"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, TrendingUp, CheckCircle, Clock, UserPlus, Bell } from "lucide-react";
import ClientDetailModal from "@/components/ClientDetailModal";

export default function HeadAccountManagerClient({ projects, accountManagers, headTechnicals, kpis, userId }: any) {
  const router = useRouter();
  const [filterAM, setFilterAM] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterWarning, setFilterWarning] = useState("all");
  const [filterDelay, setFilterDelay] = useState("all");
  
  const [selectedClient, setSelectedClient] = useState<any>(null);

  const filteredProjects = useMemo(() => {
    return projects.filter((p: any) => {
      const matchesAM = filterAM === "all" ? true : filterAM === "unassigned" ? !p.accountManagerId : p.accountManagerId === filterAM;
      const matchesSearch = !searchQuery || (p.deal?.lead?.name?.toLowerCase().includes(searchQuery.toLowerCase()) || p.deal?.lead?.phone?.includes(searchQuery));
      const matchesStatus = filterStatus === "all" ? true : p.projectStatus === filterStatus;
      const hasWarnings = p.warnings && p.warnings.length > 0;
      const matchesWarning = filterWarning === "all" ? true : filterWarning === "yes" ? hasWarnings : filterWarning === "no" ? !hasWarnings : true;
      
      // Check if any tasks are delayed or project is delayed
      const isDelayed = p.projectStatus === "delayed" || (p.tasks && p.tasks.some((t:any) => t.status !== "done" && t.deadline && new Date(t.deadline) < new Date()));
      const matchesDelay = filterDelay === "all" ? true : filterDelay === "yes" ? isDelayed : true;

      return matchesAM && matchesSearch && matchesStatus && matchesWarning && matchesDelay;
    });
  }, [projects, filterAM, searchQuery, filterStatus, filterWarning, filterDelay]);

  const handleAssignAM = async (projectId: string, amId: string) => {
    await fetch(`/api/projects/${projectId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountManagerId: amId || null }),
    });
    router.refresh();
  };

  const getProgressColor = (val: number) => val < 30 ? "bg-red-500" : val < 70 ? "bg-amber-400" : "bg-emerald-500";

  return (
    <div className="space-y-8">
      {/* ── KPI Grid ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
        {[
          { label: "Total Projects", val: kpis.total, colors: "bg-white border-slate-200 text-slate-800" },
          { label: "New Today", val: kpis.newToday, colors: "bg-blue-50 border-blue-200 text-blue-900" },
          { label: "Active", val: kpis.active, colors: "bg-indigo-50 border-indigo-200 text-indigo-900" },
          { label: "Unassigned", val: kpis.unassigned, colors: "bg-purple-50 border-purple-200 text-purple-900" },
          { label: "Delayed", val: kpis.delayed, colors: "bg-red-50 border-red-200 text-red-900" },
          { label: "Completed", val: kpis.completed, colors: "bg-emerald-50 border-emerald-200 text-emerald-900" },
          { label: "Warnings", val: kpis.warnings, colors: "bg-orange-50 border-orange-200 text-orange-900" },
          { label: "Avg Progress", val: `${kpis.avgCompletion}%`, colors: "bg-teal-50 border-teal-200 text-teal-900" },
        ].map(k => (
          <div key={k.label} className={`p-4 rounded-xl border ${k.colors}`}>
            <p className="text-[11px] font-bold opacity-70 uppercase tracking-wider">{k.label}</p>
            <p className="text-2xl font-black mt-1">{k.val}</p>
          </div>
        ))}
      </div>

      {/* ── Account Managers Workload ── */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="text-lg font-bold text-slate-800 mb-4">Account Managers Workload</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <button 
            onClick={() => setFilterAM("unassigned")}
            className={`p-4 rounded-xl border text-left transition ${filterAM === "unassigned" ? "bg-purple-50 border-purple-500 ring-1 ring-purple-500" : "bg-slate-50 hover:border-slate-300"}`}
          >
            <p className="text-sm font-bold text-slate-700">⚠️ Unassigned</p>
            <p className="text-2xl font-black text-purple-600 mt-2">{kpis.unassigned}</p>
            <p className="text-xs text-slate-400 mt-1">Needs delegation</p>
          </button>
          
          {accountManagers.map((am: any) => {
            const loadProjects = am.managedProjects || [];
            const load = loadProjects.length;
            const delayedCount = loadProjects.filter((p:any) => p.projectStatus === "delayed").length;
            const avgProg = load > 0 ? Math.round(loadProjects.reduce((acc:any, p:any) => acc + ((p.seoProgress + p.socialMediaProgress + p.mediaBuyerProgress) / 3), 0) / load) : 0;
            return (
              <button 
                key={am.id}
                onClick={() => setFilterAM(filterAM === am.id ? "all" : am.id)}
                className={`p-4 rounded-xl border text-left transition ${filterAM === am.id ? "bg-indigo-50 border-indigo-500 ring-2 ring-indigo-500" : "bg-white hover:border-slate-300"}`}
              >
                <div className="flex justify-between items-center mb-2">
                  <p className="text-sm font-bold text-slate-700 truncate" title={am.name}>{am.name.split(" ")[0]} {am.name.split(" ")[1]?.[0] || ""}.</p>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-1">
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Active</p>
                    <p className={`text-xl font-black ${load > 15 ? "text-red-500" : load > 8 ? "text-amber-500" : "text-emerald-500"}`}>{load}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Avg Prg</p>
                    <p className="text-xl font-black text-slate-700">{avgProg}%</p>
                  </div>
                </div>
                {delayedCount > 0 && <p className="text-[10px] text-red-600 font-bold mt-2 bg-red-100 rounded px-1.5 py-0.5 w-fit">{delayedCount} Delayed</p>}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Global Projects ── */}
      <div className="bg-white rounded-xl shadow border overflow-hidden">
        <div className="p-4 border-b bg-slate-50 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <h2 className="text-lg font-bold text-slate-800 whitespace-nowrap">Global Master List</h2>
            {filterAM !== "all" && (
              <button onClick={() => setFilterAM("all")} className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full hover:bg-indigo-100 whitespace-nowrap">
                Showing AM: {filterAM === "unassigned" ? "Unassigned" : accountManagers.find((a:any) => a.id === filterAM)?.name} ✕
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <input 
              type="text" 
              placeholder="Search clients..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full md:w-48 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
            />
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white outline-none">
              <option value="all">All Statuses</option>
              <option value="new">New</option>
              <option value="assigned">Assigned</option>
              <option value="setup">Setup</option>
              <option value="in_progress">In Progress</option>
              <option value="delayed">Delayed</option>
              <option value="completed">Completed</option>
            </select>
            <select value={filterWarning} onChange={e => setFilterWarning(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white outline-none">
              <option value="all">Warnings: Any</option>
              <option value="yes">With Warnings</option>
              <option value="no">No Warnings</option>
            </select>
            <select value={filterDelay} onChange={e => setFilterDelay(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white outline-none">
              <option value="all">Delay: Any</option>
              <option value="yes">Delayed Tasks/Project</option>
            </select>
          </div>
        </div>
        
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase">
            <tr>
              <th className="px-6 py-3 text-left w-64">Client & Details</th>
              <th className="px-6 py-3 text-left w-48">Assignments</th>
              <th className="px-6 py-3 text-left w-64">General Progress</th>
              <th className="px-6 py-3 text-center w-32">Status & Tasks</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredProjects.map((p: any) => {
              const hasWarnings = p.warnings && p.warnings.length > 0;
              const activeTasks = p.tasks?.filter((t:any) => t.status !== "done").length || 0;
              const delayedTasks = p.tasks?.filter((t:any) => t.status !== "done" && t.deadline && new Date(t.deadline) < new Date()).length || 0;
              const technicalTask = p.tasks?.find((t:any) => t.taskType === "technical");
              const lastActivity = p.logs && p.logs.length > 0 ? new Date(p.logs[0].createdAt).toLocaleDateString() : new Date(p.createdAt).toLocaleDateString();

              return (
                <tr key={p.id} className="hover:bg-slate-50 transition">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="font-bold text-slate-900">{p.deal?.lead?.name}</div>
                      {hasWarnings && <span title="Active Warnings"><AlertTriangle className="w-4 h-4 text-orange-500" /></span>}
                    </div>
                    <div className="text-xs text-slate-500 mb-1">{p.deal?.lead?.phone}</div>
                    <div className="flex gap-2 items-center">
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">{p.deal?.lead?.source || "Direct"}</span>
                      <span className="text-xs text-purple-600 font-bold">{p.package}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-2">
                      <div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">Account Manager</p>
                        <select 
                          value={p.accountManagerId || ""} 
                          onChange={(e) => handleAssignAM(p.id, e.target.value)} 
                          className={`text-xs border rounded px-2 py-1 font-medium outline-none w-full ${!p.accountManagerId ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-white"}`}
                        >
                          <option value="">⚠️ Unassigned</option>
                          {accountManagers.map((am: any) => (
                            <option key={am.id} value={am.id}>{am.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">Head Technical</p>
                        <div className="text-xs font-semibold px-2 py-1 bg-slate-50 border rounded w-full truncate text-slate-500 cursor-not-allowed" title="Assigned through Client Full Journey Page">
                          {technicalTask ? technicalTask.leader?.name : "Pending Request"}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="w-full space-y-1">
                      {[{ label: "SEO", val: p.seoProgress }, { label: "SMM", val: p.socialMediaProgress }, { label: "Media", val: p.mediaBuyerProgress }].map((b) => (
                        <div key={b.label} className="flex items-center text-[10px]">
                          <span className="w-8 font-bold text-slate-400">{b.label}</span>
                          <div className="flex-1 bg-slate-100 h-1 mx-2 rounded-full overflow-hidden">
                            <div className={`${getProgressColor(b.val)} h-1`} style={{ width: `${b.val}%` }} />
                          </div>
                          <span className="w-6 text-right font-bold text-slate-600">{b.val.toFixed(0)}%</span>
                        </div>
                      ))}
                      <div className="text-[10px] text-slate-400 text-right mt-1 font-medium">Activity: {lastActivity}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex flex-col gap-1 items-center">
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded capitalize border ${p.projectStatus === "completed" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : p.projectStatus === "delayed" ? "bg-red-50 text-red-700 border-red-200" : p.projectStatus === "in_progress" ? "bg-blue-50 text-blue-700 border-blue-200" : p.projectStatus === "new" ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-slate-50 text-slate-700 border-slate-200"}`}>
                        {p.projectStatus.replace(/_/g, " ")}
                      </span>
                      <div className="text-xs text-slate-500 font-medium mt-1 whitespace-nowrap">
                        {activeTasks} Active
                      </div>
                      {delayedTasks > 0 && <span className="text-[10px] text-red-600 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded font-bold">{delayedTasks} Delayed Tasks</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => setSelectedClient(p)} className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-medium hover:bg-slate-900 shadow-sm transition inline-flex items-center gap-2 whitespace-nowrap">
                      Client Center <span>→</span>
                    </button>
                    <button onClick={() => router.push(`/dashboard/clients/${p.id}`)} className="block w-full mt-2 text-center text-[10px] text-indigo-600 font-bold hover:underline">
                      Full Portal UI
                    </button>
                  </td>
                </tr>
              );
            })}
            {filteredProjects.length === 0 && (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-sm text-slate-400 italic">No projects found for current filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedClient && (
        <ClientDetailModal 
          isOpen={!!selectedClient}
          onClose={() => setSelectedClient(null)}
          project={selectedClient}
          currentUserRole="head_account_manager"
        />
      )}
    </div>
  );
}
