"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, TrendingUp, CheckCircle, Clock, UserPlus, Bell } from "lucide-react";
import ClientDetailModal from "@/components/ClientDetailModal";
import LifecycleStateBadge from "@/components/LifecycleStateBadge";
import LifecycleChangeModal from "@/components/LifecycleChangeModal";
import DistributeModal from "@/components/DistributeModal";
import ClientReassignModal from "@/components/ClientReassignModal";
import CreateWarningModal from "@/components/CreateWarningModal";
import { distributeProject as distributeProjectRequest, updateProjectStatus } from "@/client/api/projects";
import HeadAccountManagerKpiGrid from "./HeadAccountManagerKpiGrid";
import HeadAccountManagerWorkload from "./HeadAccountManagerWorkload";

export default function HeadAccountManagerClient({ projects, accountManagers, headTechnicals, headSeoUsers, kpis, userId }: any) {
  const router = useRouter();
  const [filterAM, setFilterAM] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterWarning, setFilterWarning] = useState("all");
  const [filterDelay, setFilterDelay] = useState("all");
  const [filterLifecycle, setFilterLifecycle] = useState("all");
  const [activeKpi, setActiveKpi] = useState("all");
  
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [lifecycleProject, setLifecycleProject] = useState<any>(null);
  const [distributeProject, setDistributeProject] = useState<any>(null);
  const [distributeSeoProject, setDistributeSeoProject] = useState<any>(null);
  const [reassignProject, setReassignProject] = useState<any>(null);
  const [warningProject, setWarningProject] = useState<any>(null);
  const [taskFilter, setTaskFilter] = useState("all");

  const allTasks = useMemo(() => projects.flatMap((p: any) => p.tasks || []), [projects]);

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

      let matchesKpi = true;
      if (activeKpi === "newToday") {
         const today = new Date().toLocaleDateString();
         matchesKpi = new Date(p.createdAt).toLocaleDateString() === today;
      } else if (activeKpi === "active") {
         matchesKpi = ["in_progress", "setup", "assigned"].includes(p.projectStatus);
      } else if (activeKpi === "unassigned") {
         matchesKpi = !p.accountManagerId;
      } else if (activeKpi === "delayed") {
         matchesKpi = isDelayed;
      } else if (activeKpi === "completed") {
         matchesKpi = p.projectStatus === "completed";
      } else if (activeKpi === "warnings") {
         matchesKpi = hasWarnings;
      }

      const matchesLifecycle = filterLifecycle === "all" ? true : p.lifecycleState === filterLifecycle;

      return matchesAM && matchesSearch && matchesStatus && matchesWarning && matchesDelay && matchesKpi && matchesLifecycle;
    });
  }, [projects, filterAM, searchQuery, filterStatus, filterWarning, filterDelay, activeKpi, filterLifecycle]);

  const handleAssignAM = async (projectId: string, amId: string) => {
    if (amId) {
      await distributeProjectRequest({ projectId, targetUserId: amId });
    } else {
      await updateProjectStatus(projectId, {
        accountManagerId: null,
        details: "Account Manager unassigned by Head Account Manager",
      });
    }
    router.refresh();
  };

  const getProgressColor = (val: number) => val < 30 ? "bg-red-500" : val < 70 ? "bg-amber-400" : "bg-emerald-500";

  return (
    <div className="space-y-8">
      {/* ── KPI Grid ── */}
      <HeadAccountManagerKpiGrid kpis={kpis} activeKpi={activeKpi} setActiveKpi={setActiveKpi} />

      {/* ── Account Managers Workload ── */}
      <HeadAccountManagerWorkload
        accountManagers={accountManagers}
        kpis={kpis}
        filterAM={filterAM}
        setFilterAM={setFilterAM}
      />

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
            <select value={filterLifecycle} onChange={e => setFilterLifecycle(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white outline-none">
              <option value="all">Lifecycle: All</option>
              <option value="Onboarding">Onboarding</option>
              <option value="Active">Active</option>
              <option value="On_Hold">On Hold</option>
              <option value="Completed">Completed</option>
              <option value="Churned">Churned</option>
            </select>
          </div>
        </div>
        
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase">
            <tr>
              <th className="px-6 py-3 text-left w-64">Client & Details</th>
              <th className="px-6 py-3 text-left w-32">Lifecycle</th>
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
                    <div className="flex flex-col gap-2">
                      <LifecycleStateBadge state={p.lifecycleState || "Onboarding"} compact />
                      <button
                        onClick={() => setLifecycleProject(p)}
                        className="text-[10px] text-indigo-600 font-bold hover:underline"
                      >
                        Change
                      </button>
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
                          {p.headTechnical?.name || "Pending Request"}
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">Head SEO</p>
                        <div className="text-xs font-semibold px-2 py-1 bg-slate-50 border rounded w-full truncate text-slate-500 cursor-not-allowed" title="Assigned through Client Full Journey Page">
                          {p.headSeo?.name || "Pending Request"}
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
                    <div className="flex flex-col gap-1 items-end">
                      <button onClick={() => setSelectedClient(p)} className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-medium hover:bg-slate-900 shadow-sm transition inline-flex items-center gap-2 whitespace-nowrap">
                        Client Center <span>→</span>
                      </button>
                      <button onClick={() => setDistributeProject(p)} className="text-[10px] text-purple-600 font-bold hover:underline mt-1">
                        Assign Head Technical
                      </button>
                      <button onClick={() => setDistributeSeoProject(p)} className="text-[10px] text-teal-600 font-bold hover:underline">
                        Assign Head SEO
                      </button>
                      <button onClick={() => { setWarningProject(p); }} className="text-[10px] text-red-600 font-bold hover:underline">
                        ⚠ Send Warning
                      </button>
                      <button onClick={() => router.push(`/dashboard/clients/${p.id}`)} className="text-[10px] text-indigo-600 font-bold hover:underline">
                        Full Portal UI
                      </button>
                      {p.accountManagerId && (
                        <button onClick={() => setReassignProject(p)} className="text-[10px] text-orange-600 font-bold hover:underline">
                          Reassign AM
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredProjects.length === 0 && (
              <tr><td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-400 italic">No projects found for current filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Global Tasks Execution ── */}
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
                ✕ Clear
              </button>
            )}
            <span className="text-xs text-slate-400">
              {allTasks.filter((t:any) => {
                if(taskFilter === "all") return true;
                if(taskFilter === "delayed") return t.status !== "done" && t.deadline && new Date(t.deadline) < new Date();
                return t.status === taskFilter;
              }).length} tasks
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
              {allTasks
                .filter((t:any) => {
                  if(taskFilter === "all") return true;
                  if(taskFilter === "delayed") return t.status !== "done" && t.deadline && new Date(t.deadline) < new Date();
                  return t.status === taskFilter;
                })
                .sort((a:any, b:any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map((t: any) => {
                const isDelayed = t.status !== "done" && t.deadline && new Date(t.deadline) < new Date();
                const parentProject = projects.find((p:any) => p.id === t.projectId);
                return (
                 <tr key={t.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="font-bold text-slate-900 text-sm">{parentProject?.deal?.lead?.name || "Unknown"}</div>
                        {parentProject?.lifecycleState && <LifecycleStateBadge state={parentProject.lifecycleState} />}
                      </div>
                      <div className="text-xs text-slate-500">Project: {parentProject?.package || "N/A"}</div>
                    </td>
                    <td className="px-6 py-4 line-clamp-2 max-w-xs">
                      <span className="font-bold text-[10px] uppercase bg-slate-100 px-2 py-0.5 rounded text-slate-600 mr-2">{t.taskType.replace(/_/g, " ")}</span>
                      <span className="text-sm text-slate-700">{t.brief}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-semibold text-slate-800">{t.leader?.name || "Not Assigned"}</div>
                      <div className="text-xs text-slate-500">{t.agent?.name ? `Agent: ${t.agent.name}` : "Pending Agent"}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`text-sm font-medium ${isDelayed ? "text-red-600" : "text-slate-600"}`}>
                        {t.deadline ? new Date(t.deadline).toLocaleDateString() : "No Deadline"}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-0.5 text-[10px] rounded font-bold uppercase border ${t.status === "done" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : isDelayed ? "bg-red-50 text-red-700 border-red-200" : t.status === "in_progress" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-slate-50 text-slate-700 border-slate-200"}`}>
                        {isDelayed ? "DELAYED" : t.status.replace(/_/g, " ")}
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
      {selectedClient && (
        <ClientDetailModal 
          isOpen={!!selectedClient}
          onClose={() => setSelectedClient(null)}
          project={selectedClient}
          currentUserRole="head_account_manager"
        />
      )}

      {lifecycleProject && (
        <LifecycleChangeModal
          isOpen={!!lifecycleProject}
          onClose={() => setLifecycleProject(null)}
          projectId={lifecycleProject.id}
          currentState={lifecycleProject.lifecycleState || "Onboarding"}
          projectName={lifecycleProject.deal?.lead?.name || "Unknown Client"}
          onChanged={() => { setLifecycleProject(null); router.refresh(); }}
        />
      )}

      {distributeProject && (
        <DistributeModal
          isOpen={!!distributeProject}
          onClose={() => setDistributeProject(null)}
          projectId={distributeProject.id}
          projectName={distributeProject.deal?.lead?.name || "Unknown Client"}
          availableUsers={headTechnicals}
          actionLabel="Assign Head Technical"
          onDistributed={() => { setDistributeProject(null); router.refresh(); }}
        />
      )}

      {reassignProject && (
        <ClientReassignModal
          isOpen={!!reassignProject}
          onClose={() => setReassignProject(null)}
          projectId={reassignProject.id}
          clientName={reassignProject.deal?.lead?.name || "Unknown Client"}
          currentAccountManagerId={reassignProject.accountManagerId}
          onSuccess={() => { setReassignProject(null); router.refresh(); }}
        />
      )}

      {distributeSeoProject && (
        <DistributeModal
          isOpen={!!distributeSeoProject}
          onClose={() => setDistributeSeoProject(null)}
          projectId={distributeSeoProject.id}
          projectName={distributeSeoProject.deal?.lead?.name || "Unknown Client"}
          availableUsers={headSeoUsers || []}
          actionLabel="Assign Head SEO"
          onDistributed={() => { setDistributeSeoProject(null); router.refresh(); }}
        />
      )}

      {warningProject && (
        <CreateWarningModal
          isOpen={!!warningProject}
          onClose={() => setWarningProject(null)}
          projectId={warningProject.id}
          clientId={warningProject.deal?.leadId}
        />
      )}
    </div>
  );
}
