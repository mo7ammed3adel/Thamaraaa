"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Operations Hub client component with advanced filtering, status management,
 * and full CRUD project interactions for Account Managers, Team Leaders,
 * and Operations Agents.
 */
export default function OperationsClient({
  userRole, userId, projects, leaderTasks, agentTasks, teamLeaders, opsAgents,
}: any) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [viewProject, setViewProject] = useState<any>(null);

  // ── Advanced Filters ──
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [packageFilter, setPackageFilter] = useState("all");
  const [taskStatusFilter, setTaskStatusFilter] = useState("all");

  // ── Status Change Modal ──
  const [statusModal, setStatusModal] = useState<any>(null);
  const [newStatus, setNewStatus] = useState("");

  const isAM = userRole === "account_manager" || userRole === "super_admin";
  const isTL = userRole === "team_leader" || userRole === "super_admin";
  const isAgent = userRole === "operations_agent" || userRole === "super_admin";

  // ── Filter Logic ──
  const uniquePackages = Array.from(new Set(projects.map((p: any) => p.package)));

  const filteredProjects = projects.filter((p: any) => {
    const matchesSearch =
      !searchQuery ||
      p.deal?.lead?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.deal?.lead?.phone?.includes(searchQuery) ||
      p.niche?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || p.projectStatus === statusFilter;
    const matchesPackage = packageFilter === "all" || p.package === packageFilter;
    return matchesSearch && matchesStatus && matchesPackage;
  });

  const filteredLeaderTasks = leaderTasks.filter((t: any) => {
    const matchesSearch =
      !searchQuery ||
      t.project?.deal?.lead?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = taskStatusFilter === "all" || t.status === taskStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredAgentTasks = agentTasks.filter((t: any) => {
    const matchesSearch =
      !searchQuery ||
      t.project?.deal?.lead?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = taskStatusFilter === "all" || t.status === taskStatusFilter;
    return matchesSearch && matchesStatus;
  });

  // ── Handlers ──
  async function handleAssignProjectToLeaders(projectId: string, packageType: string) {
    setLoading(true);
    const tlSeo = teamLeaders.find((l: any) => l.name.includes("SEO")) || teamLeaders[0];
    const tlSocial = teamLeaders.find((l: any) => l.name.includes("Social")) || teamLeaders[0];
    await fetch("/api/tasks/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, packageType, seoLeaderId: tlSeo?.id, socialLeaderId: tlSocial?.id }),
    });
    setLoading(false);
    router.refresh();
  }

  async function handleAssignTask(taskId: string, agentId: string) {
    await fetch("/api/tasks/" + taskId, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId }),
    });
    router.refresh();
  }

  async function toggleChecklistItem(task: any, itemId: string) {
    let checklists = [];
    try { checklists = JSON.parse(task.checklistItems || "[]"); } catch {}
    const updatedChecklists = checklists.map((c: any) =>
      c.id === itemId ? { ...c, completed: !c.completed } : c
    );
    const completedCount = updatedChecklists.filter((c: any) => c.completed).length;
    const totalCount = updatedChecklists.length;
    const newProgress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
    await fetch("/api/tasks/" + task.id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ progressPct: newProgress, checklistItems: JSON.stringify(updatedChecklists) }),
    });
    router.refresh();
  }

  async function handleChangeProjectStatus(projectId: string, status: string) {
    await fetch("/api/projects/" + projectId + "/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectStatus: status }),
    });
    setStatusModal(null);
    setNewStatus("");
    router.refresh();
  }

  // ── Filter Bar Component ──
  function FilterBar({ showTaskFilter }: { showTaskFilter?: boolean }) {
    return (
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl border p-4 shadow-sm">
        <input
          type="text"
          placeholder="🔍 Search client, phone, niche..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 min-w-[200px] border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
        />
        {!showTaskFilter && (
          <>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="new">New</option>
              <option value="setup">Setup</option>
              <option value="assigned">Assigned</option>
              <option value="in_progress">In Progress</option>
              <option value="on_hold">On Hold</option>
              <option value="delayed">Delayed</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select
              value={packageFilter}
              onChange={(e) => setPackageFilter(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="all">All Packages</option>
              {uniquePackages.map((pkg: any) => (
                <option key={pkg} value={pkg}>{pkg}</option>
              ))}
            </select>
          </>
        )}
        {showTaskFilter && (
          <select
            value={taskStatusFilter}
            onChange={(e) => setTaskStatusFilter(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="review">Review</option>
            <option value="done">Done</option>
          </select>
        )}
        {(searchQuery || statusFilter !== "all" || packageFilter !== "all" || taskStatusFilter !== "all") && (
          <button
            onClick={() => { setSearchQuery(""); setStatusFilter("all"); setPackageFilter("all"); setTaskStatusFilter("all"); }}
            className="px-3 py-2 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition"
          >
            ✕ Clear
          </button>
        )}
      </div>
    );
  }

  // ── Project Details Drawer ──
  function ProjectDetailsModal({ project, onClose }: { project: any; onClose: () => void }) {
    return (
      <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-sm">
        <div className="w-full max-w-2xl bg-white h-full shadow-2xl p-6 overflow-y-auto flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-slate-800">Project Details</h2>
            <button onClick={onClose} className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full hover:bg-slate-200">Close ✕</button>
          </div>
          <div className="space-y-6 flex-1">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <h3 className="font-semibold text-slate-700 mb-2">Overview</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-slate-500 block">Client Name</span><span className="font-medium">{project.deal.lead.name}</span></div>
                <div><span className="text-slate-500 block">Phone</span><span className="font-medium">{project.deal.lead.phone}</span></div>
                <div><span className="text-slate-500 block">Package</span><span className="font-medium text-purple-700">{project.package}</span></div>
                <div><span className="text-slate-500 block">Niche</span><span className="font-medium">{project.niche || "N/A"}</span></div>
                <div><span className="text-slate-500 block">Status</span><span className="font-medium capitalize">{project.projectStatus.replace(/_/g, " ")}</span></div>
                <div><span className="text-slate-500 block">Deadline</span><span className="font-medium">{project.finalDeadline ? new Date(project.finalDeadline).toLocaleDateString() : "Not Set"}</span></div>
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="font-semibold text-slate-700 mb-3">Progress</h3>
              <div className="space-y-3">
                {[
                  { label: "SEO", value: project.seoProgress },
                  { label: "Social Media", value: project.socialMediaProgress },
                  { label: "Media Buyer", value: project.mediaBuyerProgress },
                ].map((item) => (
                  <div key={item.label} className="flex items-center text-sm">
                    <span className="w-24 font-medium text-slate-600">{item.label}</span>
                    <div className="flex-1 bg-slate-200 rounded-full h-2 mx-3 overflow-hidden">
                      <div className={`h-2 rounded-full ${item.value < 30 ? "bg-red-500" : item.value < 70 ? "bg-amber-400" : "bg-emerald-500"}`} style={{ width: `${item.value}%` }} />
                    </div>
                    <span className="w-10 text-right font-bold text-slate-700">{item.value}%</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="font-semibold text-slate-700 mb-3">Service Handoff</h3>
              {project.tasks?.length > 0 ? (
                <ul className="space-y-2">
                  {project.tasks.map((t: any) => (
                    <li key={t.id} className="flex justify-between text-sm p-2 bg-slate-50 rounded">
                      <span className="font-medium text-slate-700 capitalize">{t.taskType.replace(/_/g, " ")}</span>
                      <span className="text-slate-500">Leader: {t.leader?.name || "Unassigned"} • <span className="capitalize">{t.status}</span></span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm text-slate-500 italic">No tasks assigned yet.</div>
              )}
            </div>
            <div className="flex gap-2 pt-4 border-t border-slate-100">
              <button onClick={() => { setStatusModal(project); onClose(); }} className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium text-sm hover:bg-indigo-700 transition">
                Change Status
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const getProgressColor = (val: number) => val < 30 ? "bg-red-500" : val < 70 ? "bg-amber-400" : "bg-emerald-500";

  return (
    <div className="space-y-10">
      {/* ═══ Account Manager View ═══ */}
      {isAM && (
        <section className="space-y-5">
          <h2 className="text-xl font-bold text-slate-800">Account Manager Dashboard</h2>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: "Total Projects", value: projects.length, cls: "bg-white border" },
              { label: "Setup Phase", value: projects.filter((p: any) => p.projectStatus === "setup").length, cls: "bg-indigo-50 border-indigo-100" },
              { label: "Active", value: projects.filter((p: any) => ["in_progress", "assigned"].includes(p.projectStatus)).length, cls: "bg-blue-50 border-blue-100" },
              { label: "Delayed", value: projects.filter((p: any) => p.projectStatus === "delayed").length, cls: "bg-red-50 border-red-100" },
              { label: "Completed", value: projects.filter((p: any) => p.projectStatus === "completed").length, cls: "bg-emerald-50 border-emerald-100" },
            ].map((kpi) => (
              <button key={kpi.label} onClick={() => setStatusFilter(kpi.label === "Total Projects" ? "all" : kpi.label === "Setup Phase" ? "setup" : kpi.label === "Active" ? "in_progress" : kpi.label === "Delayed" ? "delayed" : "completed")} className={`${kpi.cls} p-4 rounded-xl border shadow-sm flex flex-col justify-center items-center hover:shadow-md transition cursor-pointer`}>
                <span className="text-sm font-medium text-slate-500">{kpi.label}</span>
                <span className="text-2xl font-bold text-slate-800">{kpi.value}</span>
              </button>
            ))}
          </div>

          {/* Filters */}
          <FilterBar />

          {/* Filtered count */}
          <p className="text-xs text-slate-400">Showing {filteredProjects.length} of {projects.length} projects</p>

          {/* Projects Table */}
          <div className="bg-white rounded-xl shadow border overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Client & Deal</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Type / Timeline</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Progress Tracking</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredProjects.map((p: any) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-bold text-slate-900">{p.deal.lead.name}</div>
                      <div className="text-xs font-medium text-slate-500">{p.deal.lead.phone} • {p.niche || "No Niche"}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 mb-1">{p.package}</div>
                      <div className="text-xs text-slate-500">Deadline: {p.finalDeadline ? new Date(p.finalDeadline).toLocaleDateString() : "Not Set"}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="w-full max-w-xs space-y-2">
                        {[{ label: "SEO", val: p.seoProgress }, { label: "Social", val: p.socialMediaProgress }, { label: "Media", val: p.mediaBuyerProgress }].map((bar) => (
                          <div key={bar.label} className="flex items-center text-xs">
                            <span className="w-12 font-medium text-slate-600">{bar.label}</span>
                            <div className="flex-1 bg-slate-200 rounded-full h-1.5 mx-2 overflow-hidden"><div className={`${getProgressColor(bar.val)} h-1.5 rounded-full`} style={{ width: `${bar.val}%` }} /></div>
                            <span className="w-8 text-right font-medium text-slate-700">{bar.val.toFixed(0)}%</span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button onClick={() => { setStatusModal(p); setNewStatus(p.projectStatus); }} className={`px-2 py-1 text-xs font-semibold rounded-full cursor-pointer hover:opacity-80 transition ${p.projectStatus === "setup" ? "bg-indigo-100 text-indigo-700" : p.projectStatus === "assigned" ? "bg-blue-100 text-blue-700" : p.projectStatus === "in_progress" ? "bg-amber-100 text-amber-700" : p.projectStatus === "delayed" ? "bg-red-100 text-red-700" : p.projectStatus === "completed" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"}`}>
                        {p.projectStatus.replace(/_/g, " ")}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
                      {p.projectStatus === "setup" ? (
                        <button onClick={() => handleAssignProjectToLeaders(p.id, p.package)} disabled={loading} className="px-3 py-1.5 bg-indigo-600 text-white rounded text-xs font-medium hover:bg-indigo-700 shadow-sm transition disabled:opacity-50">
                          {loading ? "..." : "Assign Leaders"}
                        </button>
                      ) : (
                        <button onClick={() => setViewProject(p)} className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded text-xs font-medium hover:bg-slate-50 transition">
                          View Details
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredProjects.length === 0 && (
                  <tr><td colSpan={5} className="px-6 py-12 text-center text-sm text-slate-400 italic">No projects match your filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {viewProject && <ProjectDetailsModal project={viewProject} onClose={() => setViewProject(null)} />}
        </section>
      )}

      {/* ═══ Team Leader View ═══ */}
      {isTL && (
        <section>
          <h2 className="text-xl font-bold mb-4 text-orange-900">Team Leader: Pending Tasks</h2>
          <FilterBar showTaskFilter />
          <p className="text-xs text-slate-400 mt-2 mb-3">Showing {filteredLeaderTasks.length} of {leaderTasks.length} tasks</p>
          <div className="bg-white rounded-xl shadow border">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-orange-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Project</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Task Type</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assign Agent</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredLeaderTasks.map((t: any) => (
                  <tr key={t.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{t.project?.deal?.lead?.name || "Unknown"}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">{t.taskType.replace(/_/g, " ")}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${t.status === "done" ? "bg-emerald-100 text-emerald-700" : t.status === "in_progress" ? "bg-amber-100 text-amber-700" : t.status === "review" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>{t.status || "pending"}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {t.agentId ? (
                        <span className="text-gray-900 font-medium">{t.agent?.name}</span>
                      ) : (
                        <select onChange={(e) => handleAssignTask(t.id, e.target.value)} className="border rounded-lg p-1.5 text-sm bg-gray-50 focus:ring-2 focus:ring-orange-500 outline-none">
                          <option value="">Assign...</option>
                          {opsAgents.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold">{t.progressPct}%</td>
                  </tr>
                ))}
                {filteredLeaderTasks.length === 0 && (
                  <tr><td colSpan={5} className="px-6 py-12 text-center text-sm text-slate-400 italic">No tasks match your filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ═══ Operations Agent View ═══ */}
      {isAgent && (
        <section>
          <h2 className="text-xl font-bold mb-4 text-green-900">My Operations Tasks</h2>
          <FilterBar showTaskFilter />
          <p className="text-xs text-slate-400 mt-2 mb-3">Showing {filteredAgentTasks.length} of {agentTasks.length} tasks</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAgentTasks.map((t: any) => {
              let checklists: any[] = [];
              try { checklists = JSON.parse(t.checklistItems || "[]"); } catch {}
              return (
                <div key={t.id} className="bg-white rounded-xl shadow border p-5 hover:shadow-md transition">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="font-bold text-gray-900">{t.project?.deal?.lead?.name}</h3>
                    <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded font-medium capitalize">{t.taskType.replace(/_/g, " ")}</span>
                  </div>
                  <div className="mb-4">
                    <div className="flex justify-between text-xs text-gray-500 mb-1"><span>Progress</span><span>{t.progressPct}%</span></div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5"><div className="bg-green-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${t.progressPct}%` }} /></div>
                  </div>
                  <div className="space-y-2 mt-4 border-t pt-4">
                    <h4 className="text-sm font-semibold text-gray-700">Checklist</h4>
                    {checklists.map((item: any) => (
                      <label key={item.id} className="flex items-center gap-3 cursor-pointer group">
                        <input type="checkbox" checked={item.completed} onChange={() => toggleChecklistItem(t, item.id)} className="w-4 h-4 text-green-600 rounded border-gray-300 focus:ring-green-500" />
                        <span className={`text-sm select-none ${item.completed ? "text-gray-400 line-through" : "text-gray-700 group-hover:text-green-700"}`}>{item.title}</span>
                      </label>
                    ))}
                    {checklists.length === 0 && <p className="text-xs text-gray-500 italic">No checklist items defined.</p>}
                  </div>
                </div>
              );
            })}
            {filteredAgentTasks.length === 0 && <p className="text-gray-500 text-sm col-span-full text-center py-8">No tasks match your filters.</p>}
          </div>
        </section>
      )}

      {/* ═══ Status Change Modal ═══ */}
      {statusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Change Project Status</h3>
            <p className="text-sm text-slate-500 mb-4">{statusModal.deal?.lead?.name}</p>
            <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm mb-4 focus:ring-2 focus:ring-indigo-500 outline-none">
              {["new", "setup", "assigned", "in_progress", "on_hold", "delayed", "completed", "cancelled"].map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button onClick={() => setStatusModal(null)} className="flex-1 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200">Cancel</button>
              <button onClick={() => handleChangeProjectStatus(statusModal.id, newStatus)} className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Update</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
