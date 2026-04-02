"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ClientJourney from "@/components/ClientJourney";

export default function HeadAccountManagerClient({ projects, accountManagers, warnings, kpis, userId }: any) {
  const router = useRouter();
  const [viewProject, setViewProject] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"journey" | "teams" | "tasks" | "payments">("journey");
  const [filter, setFilter] = useState("all");
  const [warningText, setWarningText] = useState("");
  const [sendingWarning, setSendingWarning] = useState(false);

  const filtered = filter === "all" ? projects : projects.filter((p: any) => p.projectStatus === filter);

  const handleAssignAM = async (projectId: string, amId: string) => {
    await fetch(`/api/projects/${projectId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountManagerId: amId }),
    });
    router.refresh();
  };

  const handleSendWarning = async (project: any) => {
    if (!warningText.trim()) return;
    setSendingWarning(true);
    await fetch("/api/warnings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: warningText,
        projectId: project.id,
        clientId: project.deal?.lead?.id,
        recipientRoles: ["account_manager", "head_technical", "head_seo", "team_leader_social_media", "team_leader_media_buyer", "leader_graphic_designer", "leader_motion_graphic", "leader_ui"],
      }),
    });
    setWarningText("");
    setSendingWarning(false);
    router.refresh();
  };

  return (
    <div className="space-y-8">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border shadow-sm text-center"><p className="text-sm text-slate-500">Total Projects</p><p className="text-3xl font-bold text-slate-800 mt-1">{kpis.total}</p></div>
        <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100 text-center"><p className="text-sm text-blue-600">Active</p><p className="text-3xl font-bold text-blue-700 mt-1">{kpis.active}</p></div>
        <div className="bg-emerald-50 p-5 rounded-2xl border border-emerald-100 text-center"><p className="text-sm text-emerald-600">Completed</p><p className="text-3xl font-bold text-emerald-700 mt-1">{kpis.completed}</p></div>
        <div className="bg-amber-50 p-5 rounded-2xl border border-amber-100 text-center"><p className="text-sm text-amber-600">On-Time</p><p className="text-3xl font-bold text-amber-700 mt-1">{kpis.onTime}</p></div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {["all", "new", "setup", "assigned", "in_progress", "completed", "delayed"].map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 text-xs font-medium rounded-full transition ${filter === f ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
            {f === "all" ? "All" : f.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {/* Projects Table */}
      <div className="bg-white rounded-xl shadow border overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Client</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Package</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Account Manager</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Teams</th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Status</th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Revenue</th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((p: any) => (
              <tr key={p.id} className="hover:bg-slate-50/50 transition">
                <td className="px-6 py-4">
                  <div className="font-bold text-slate-900">{p.deal?.lead?.name}</div>
                  <div className="text-xs text-slate-500">{p.deal?.lead?.phone}</div>
                </td>
                <td className="px-6 py-4"><span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">{p.package}</span></td>
                <td className="px-6 py-4">
                  {p.accountManager ? (
                    <span className="text-sm font-medium text-slate-700">{p.accountManager.name}</span>
                  ) : (
                    <select onChange={(e) => handleAssignAM(p.id, e.target.value)} className="text-sm border rounded-lg px-2 py-1 bg-white">
                      <option value="">Assign AM...</option>
                      {accountManagers.map((am: any) => <option key={am.id} value={am.id}>{am.name}</option>)}
                    </select>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">{p.tasks?.length || 0} tasks</td>
                <td className="px-6 py-4 text-center">
                  <span className={`px-2 py-1 text-xs rounded-full font-semibold ${p.projectStatus === "completed" ? "bg-emerald-100 text-emerald-700" : p.projectStatus === "delayed" ? "bg-red-100 text-red-700" : p.projectStatus === "in_progress" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                    {p.projectStatus.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="px-6 py-4 text-right text-sm font-bold text-emerald-700">{p.deal?.totalAmount?.toLocaleString()} EGP</td>
                <td className="px-6 py-4 text-right">
                  <button onClick={() => setViewProject(p)} className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-50 transition">
                    View Profile
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Client Profile Modal */}
      {viewProject && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-sm">
          <div className="w-full max-w-3xl bg-white h-full shadow-2xl overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center z-10">
              <h2 className="text-xl font-bold text-slate-800">Client Profile: {viewProject.deal?.lead?.name}</h2>
              <button onClick={() => setViewProject(null)} className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full hover:bg-slate-200 text-sm">Close ✕</button>
            </div>

            {/* Tabs */}
            <div className="border-b px-6">
              <div className="flex gap-1">
                {(["journey", "teams", "tasks", "payments"] as const).map((tab) => (
                  <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-3 text-sm font-medium border-b-2 transition capitalize ${activeTab === tab ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-400 hover:text-slate-600"}`}>
                    {tab === "journey" ? "📅 Journey" : tab === "teams" ? "👥 Teams" : tab === "tasks" ? "📋 Tasks" : "💰 Payments"}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-6">
              {/* Journey Tab */}
              {activeTab === "journey" && (
                <ClientJourney
                  leadName={viewProject.deal?.lead?.name}
                  phone={viewProject.deal?.lead?.phone}
                  callLogs={viewProject.deal?.lead?.callLogs}
                  meetings={viewProject.deal?.lead?.meetings}
                  deals={viewProject.deal?.lead?.deals}
                  projectNotes={viewProject.notes}
                  tasks={viewProject.tasks}
                />
              )}

              {/* Teams Tab */}
              {activeTab === "teams" && (
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-slate-700 mb-2">Assigned Teams</h3>
                  {viewProject.tasks?.length > 0 ? viewProject.tasks.map((t: any) => (
                    <div key={t.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{t.taskType.replace(/_/g, " ")}</p>
                        <p className="text-xs text-slate-500">Leader: {t.leader?.name || "Unassigned"} {t.agent ? `→ Agent: ${t.agent.name}` : ""}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-slate-200 rounded-full h-1.5"><div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${t.progressPct}%` }} /></div>
                        <span className="text-xs font-bold text-slate-600">{t.progressPct}%</span>
                      </div>
                    </div>
                  )) : <p className="text-sm text-slate-400 italic">No teams assigned yet.</p>}
                </div>
              )}

              {/* Tasks Tab */}
              {activeTab === "tasks" && (
                <div className="space-y-2">
                  <h3 className="text-sm font-bold text-slate-700 mb-2">All Tasks</h3>
                  {viewProject.tasks?.map((t: any) => (
                    <div key={t.id} className="p-3 bg-white border rounded-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm font-semibold">{t.taskType.replace(/_/g, " ")}</p>
                          <p className="text-xs text-slate-500">
                            {t.status || "pending"} • Priority: {t.priority || "Medium"} • {t.progressPct}%
                          </p>
                          {t.brief && <p className="text-xs text-slate-600 mt-1">{t.brief}</p>}
                        </div>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${t.status === "done" ? "bg-emerald-100 text-emerald-700" : t.status === "in_progress" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
                          {t.status || "pending"}
                        </span>
                      </div>
                      {t.subTasks?.length > 0 && (
                        <div className="mt-2 pl-4 border-l-2 border-slate-200 space-y-1">
                          {t.subTasks.map((st: any) => (
                            <p key={st.id} className="text-xs text-slate-500">↳ {st.taskType}: {st.status || "pending"} ({st.progressPct}%)</p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Payments Tab */}
              {activeTab === "payments" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 text-center">
                      <p className="text-xs text-emerald-600">Total</p>
                      <p className="text-lg font-bold text-emerald-700">{viewProject.deal?.totalAmount?.toLocaleString()} EGP</p>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-center">
                      <p className="text-xs text-blue-600">First Payment</p>
                      <p className="text-lg font-bold text-blue-700">{viewProject.deal?.firstAmount?.toLocaleString() || "N/A"} EGP</p>
                    </div>
                    <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 text-center">
                      <p className="text-xs text-amber-600">Method</p>
                      <p className="text-lg font-bold text-amber-700">{viewProject.deal?.paymentMethod || "N/A"}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Warning Section */}
              <div className="mt-6 pt-4 border-t">
                <h3 className="text-sm font-bold text-red-700 mb-2">⚠️ Send Warning</h3>
                <div className="flex gap-2">
                  <input value={warningText} onChange={(e) => setWarningText(e.target.value)} className="flex-1 border border-red-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300" placeholder="Type warning message..." />
                  <button onClick={() => handleSendWarning(viewProject)} disabled={sendingWarning || !warningText.trim()} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                    {sendingWarning ? "Sending..." : "Send Warning"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
