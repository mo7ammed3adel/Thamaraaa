"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";

/**
 * Operations Hub strictly for Account Managers.
 * Workflow: Receive Project -> Setup (Brief/Links) -> Push to Teams -> Monitor Progress.
 */
export default function OperationsClient({
  userRole, userId, projects, teamLeaders,
}: any) {
  const router = useRouter();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Modals
  const [setupModal, setSetupModal] = useState<any>(null);
  const [statusModal, setStatusModal] = useState<any>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [packageFilter, setPackageFilter] = useState("all");

  const uniquePackages = useMemo(() => Array.from(new Set(projects.map((p: any) => p.package))), [projects]);

  const filteredProjects = useMemo(() => {
    return projects.filter((p: any) => {
      const matchesSearch =
        !searchQuery ||
        p.deal?.lead?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.deal?.lead?.phone?.includes(searchQuery) ||
        p.niche?.toLowerCase().includes(searchQuery.toLowerCase());
      
      let matchesStatus = false;
      if (statusFilter === "all") {
        matchesStatus = true;
      } else if (statusFilter === "active") {
        matchesStatus = ["in_progress", "setup", "assigned"].includes(p.projectStatus);
      } else {
        matchesStatus = p.projectStatus === statusFilter;
      }

      const matchesPackage = packageFilter === "all" || p.package === packageFilter;
      return matchesSearch && matchesStatus && matchesPackage;
    });
  }, [projects, searchQuery, statusFilter, packageFilter]);

  // KPI counts memoized
  const kpiCounts = useMemo(() => ({
    total: projects.length,
    needsSetup: projects.filter((p: any) => p.projectStatus === "new").length,
    active: projects.filter((p: any) => ["in_progress", "setup", "assigned"].includes(p.projectStatus)).length,
    delayed: projects.filter((p: any) => p.projectStatus === "delayed").length,
    completed: projects.filter((p: any) => p.projectStatus === "completed").length,
  }), [projects]);

  // ── Action Handlers (with error handling) ──

  async function handleSaveSetup(e: React.FormEvent) {
    e.preventDefault();
    setLoadingAction("setup");
    setErrorMsg(null);
    const formData = new FormData(e.target as HTMLFormElement);
    
    try {
      const res = await fetch(`/api/projects/${setupModal.id}/setup`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          niche: formData.get("niche"),
          storeUrl: formData.get("storeUrl"),
          driveLink: formData.get("driveLink"),
          finalDeadline: formData.get("finalDeadline") ? new Date(formData.get("finalDeadline") as string).toISOString() : null,
          notes: formData.get("notes"),
          projectStatus: "setup"
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save setup");
      }
      setSetupModal(null);
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save setup. Please try again.");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handlePushToTeams(projectId: string, packageType: string) {
    setLoadingAction(`push-${projectId}`);
    setErrorMsg(null);
    
    try {
      const tlSeo = teamLeaders.find((l: any) => l.role === "team_leader_seo");
      const tlSocial = teamLeaders.find((l: any) => l.role === "team_leader_social_media");
      const tlMedia = teamLeaders.find((l: any) => l.role === "team_leader_media_buyer");
      const tlDesign = teamLeaders.find((l: any) => l.role === "leader_graphic_designer");
      
      const res = await fetch("/api/tasks/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          projectId, 
          packageType, 
          seoLeaderId: tlSeo?.id, 
          socialLeaderId: tlSocial?.id,
          mediaBuyerLeaderId: tlMedia?.id,
          designLeaderId: tlDesign?.id
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to push to teams");
      }
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to push tasks to teams.");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleChangeProjectStatus(projectId: string, status: string) {
    setLoadingAction(`status-${projectId}`);
    setErrorMsg(null);
    
    try {
      const res = await fetch(`/api/projects/${projectId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectStatus: status }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to change status");
      }
      setStatusModal(null);
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to change project status.");
    } finally {
      setLoadingAction(null);
    }
  }

  const getProgressColor = (val: number) => val < 30 ? "bg-red-500" : val < 70 ? "bg-amber-400" : "bg-emerald-500";

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-slate-800">Account Manager Details</h2>

      {/* Error Banner */}
      {errorMsg && (
        <div className="flex items-center justify-between bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl text-sm">
          <span>⚠️ {errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="text-red-600 font-bold hover:text-red-800">✕</button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "My Total Projects", value: kpiCounts.total, cls: "bg-white border", filter: "all" },
          { label: "Needs Setup", value: kpiCounts.needsSetup, cls: "bg-purple-50 border-purple-100", filter: "new" },
          { label: "Active", value: kpiCounts.active, cls: "bg-blue-50 border-blue-100", filter: "active" },
          { label: "Delayed", value: kpiCounts.delayed, cls: "bg-red-50 border-red-100", filter: "delayed" },
          { label: "Completed", value: kpiCounts.completed, cls: "bg-emerald-50 border-emerald-100", filter: "completed" },
        ].map((kpi) => (
          <button key={kpi.label} onClick={() => setStatusFilter(kpi.filter)} className={`${kpi.cls} p-4 rounded-xl border shadow-sm flex flex-col justify-center items-center hover:shadow-md transition cursor-pointer`}>
            <span className="text-sm font-medium text-slate-500">{kpi.label}</span>
            <span className="text-2xl font-bold text-slate-800">{kpi.value}</span>
          </button>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl border p-4 shadow-sm">
        <input
          type="text"
          placeholder="🔍 Search client, phone, niche..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 min-w-[200px] border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white outline-none">
          <option value="all">All Statuses</option>
          <option value="active">Active (Setup/Assigned/In Progress)</option>
          {["new", "setup", "assigned", "in_progress", "on_hold", "delayed", "completed", "cancelled"].map(s => (
            <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
          ))}
        </select>
        <select value={packageFilter} onChange={(e) => setPackageFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white outline-none">
          <option value="all">All Packages</option>
          {uniquePackages.map((pkg: any) => <option key={pkg} value={pkg}>{pkg}</option>)}
        </select>
        {(searchQuery || statusFilter !== "all" || packageFilter !== "all") && (
          <button onClick={() => { setSearchQuery(""); setStatusFilter("all"); setPackageFilter("all"); }} className="px-3 py-2 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100">
            ✕ Clear
          </button>
        )}
      </div>

      <p className="text-xs text-slate-400">Showing {filteredProjects.length} of {projects.length} projects</p>

      {/* Projects Table */}
      <div className="bg-white rounded-xl shadow border overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Client & Deal</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Timelines</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Operations Progress</th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Workflow Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredProjects.map((p: any) => (
              <tr key={p.id} className="hover:bg-slate-50/50 transition">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="font-bold text-slate-900">{p.deal?.lead?.name}</div>
                  <div className="text-xs font-medium text-slate-500 mb-1">{p.deal?.lead?.phone} • {p.niche || "No Niche Set"}</div>
                  <div className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">{p.package}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-xs text-slate-500 mb-1">Assigned: {p.assignedAt ? new Date(p.assignedAt).toLocaleDateString() : "—"}</div>
                  <div className="text-xs text-slate-800 font-semibold">Deadline: {p.finalDeadline ? new Date(p.finalDeadline).toLocaleDateString() : "Needs Setup"}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="w-full max-w-[200px] space-y-1.5">
                    {[{ label: "SEO", val: p.seoProgress }, { label: "Social", val: p.socialMediaProgress }, { label: "Media", val: p.mediaBuyerProgress }].map((bar) => (
                      <div key={bar.label} className="flex items-center text-[10px]">
                        <span className="w-10 font-bold text-slate-400">{bar.label}</span>
                        <div className="flex-1 bg-slate-100 rounded-full h-1 mx-2 overflow-hidden"><div className={`${getProgressColor(bar.val)} h-1 rounded-full`} style={{ width: `${bar.val}%` }} /></div>
                        <span className="w-6 text-right font-bold text-slate-600">{bar.val.toFixed(0)}%</span>
                      </div>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                  <button onClick={() => setStatusModal(p)} className={`px-2 py-1 text-xs font-semibold rounded-full cursor-pointer hover:shadow-sm border transition ${p.projectStatus === "new" ? "bg-purple-100 text-purple-700 border-purple-200" : p.projectStatus === "setup" ? "bg-indigo-100 text-indigo-700 border-indigo-200" : p.projectStatus === "in_progress" ? "bg-amber-100 text-amber-700 border-amber-200" : p.projectStatus === "delayed" ? "bg-red-100 text-red-700 border-red-200" : p.projectStatus === "completed" ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-700"}`}>
                    {p.projectStatus.replace(/_/g, " ").toUpperCase()}
                  </button>
                </td>
                <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                  {p.projectStatus === "new" && (
                    <button onClick={() => setSetupModal(p)} className="px-3 py-1.5 bg-indigo-600 text-white rounded text-xs font-medium hover:bg-indigo-700 shadow-sm transition">
                      1. Setup Project
                    </button>
                  )}
                  {p.projectStatus === "setup" && (
                    <button onClick={() => handlePushToTeams(p.id, p.package)} disabled={loadingAction === `push-${p.id}`} className="px-3 py-1.5 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 shadow-sm transition disabled:opacity-50">
                      {loadingAction === `push-${p.id}` ? "Pushing..." : "2. Push to Teams"}
                    </button>
                  )}
                  <button onClick={() => router.push(`/dashboard/clients/${p.id}`)} className="px-3 py-1.5 bg-slate-800 text-white rounded text-xs font-medium hover:bg-slate-900 shadow-sm transition">
                    View Full Journey
                  </button>
                </td>
              </tr>
            ))}
            {filteredProjects.length === 0 && (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-sm text-slate-400 italic">No projects found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ═══ Setup Project Modal ═══ */}
      {setupModal && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col">
            <div className="flex justify-between items-center p-6 border-b">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Setup Project</h2>
                <p className="text-sm text-slate-500">{setupModal.deal?.lead?.name}</p>
              </div>
              <button onClick={() => setSetupModal(null)} className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200">✕</button>
            </div>
            <form onSubmit={handleSaveSetup} className="p-6 flex-1 overflow-y-auto space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Client Niche / Industry</label>
                <input name="niche" defaultValue={setupModal.niche} required className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g. E-commerce, Real Estate..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Final Deadline</label>
                  <input type="date" name="finalDeadline" defaultValue={setupModal.finalDeadline ? new Date(setupModal.finalDeadline).toISOString().split('T')[0] : ""} required className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Store / Website URL</label>
                <input type="url" name="storeUrl" defaultValue={setupModal.storeUrl || setupModal.deal?.lead?.storeLink} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="https://" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Google Drive Link (Assets)</label>
                <input type="url" name="driveLink" defaultValue={setupModal.driveLink} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="https://drive.google.com/..." />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Account Manager Notes (Brief)</label>
                <textarea name="notes" defaultValue={setupModal.notes} className="w-full border rounded-lg px-3 py-2 text-sm h-32 resize-none focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Enter key details for the technical and creative teams..." />
              </div>
              <div className="pt-4 border-t mt-6">
                <button type="submit" disabled={loadingAction === "setup"} className="w-full py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50 transition shadow-lg shadow-indigo-200">
                  {loadingAction === "setup" ? "Saving..." : "Save Setup & Mark Ready"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ Change Status Modal ═══ */}
      {statusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Change Status</h3>
            <p className="text-sm text-slate-500 mb-4">{statusModal.deal?.lead?.name}</p>
            <div className="flex flex-wrap gap-2 mb-6">
              {["new", "setup", "in_progress", "on_hold", "delayed", "completed", "cancelled"].map((s) => (
                <button
                  key={s}
                  onClick={() => handleChangeProjectStatus(statusModal.id, s)}
                  className={`px-3 py-2 text-xs font-bold rounded-lg border capitalize ${statusModal.projectStatus === s ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 hover:bg-slate-50"}`}
                >
                  {s.replace(/_/g, " ")}
                </button>
              ))}
            </div>
            <button onClick={() => setStatusModal(null)} className="w-full py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
