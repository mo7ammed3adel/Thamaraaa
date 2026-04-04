"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function HeadAccountManagerClient({ projects, accountManagers, kpis }: any) {
  const router = useRouter();
  const [filterAM, setFilterAM] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredProjects = projects.filter((p: any) => {
    const matchesAM = filterAM === "all" ? true : filterAM === "unassigned" ? !p.accountManagerId : p.accountManagerId === filterAM;
    const matchesSearch = !searchQuery || (p.deal?.lead?.name?.toLowerCase().includes(searchQuery.toLowerCase()) || p.deal?.lead?.phone?.includes(searchQuery));
    return matchesAM && matchesSearch;
  });

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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Total Projects", val: kpis.total, colors: "bg-white border-slate-200" },
          { label: "Active", val: kpis.active, colors: "bg-blue-50 border-blue-200 text-blue-900" },
          { label: "Unassigned", val: kpis.unassigned, colors: "bg-purple-50 border-purple-200 text-purple-900" },
          { label: "Delayed", val: kpis.delayed, colors: "bg-red-50 border-red-200 text-red-900" },
          { label: "Completed", val: kpis.completed, colors: "bg-emerald-50 border-emerald-200 text-emerald-900" },
        ].map(k => (
          <div key={k.label} className={`p-5 rounded-2xl border ${k.colors}`}>
            <p className="text-sm font-medium opacity-80">{k.label}</p>
            <p className="text-3xl font-bold mt-1">{k.val}</p>
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
            const load = am.managedProjects?.length || 0;
            return (
              <button 
                key={am.id}
                onClick={() => setFilterAM(filterAM === am.id ? "all" : am.id)}
                className={`p-4 rounded-xl border text-left transition ${filterAM === am.id ? "bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500" : "bg-white hover:border-slate-300"}`}
              >
                <p className="text-sm font-bold text-slate-700 truncate" title={am.name}>{am.name.split(" ")[0]} {am.name.split(" ")[1]?.[0] || ""}.</p>
                <div className="mt-2 flex items-end justify-between">
                  <p className={`text-2xl font-black ${load > 15 ? "text-red-500" : load > 8 ? "text-amber-500" : "text-emerald-500"}`}>{load}</p>
                  <span className="text-xs text-slate-400 mb-1">active</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Global Projects ── */}
      <div className="bg-white rounded-xl shadow border overflow-hidden">
        <div className="p-4 border-b bg-slate-50 flex gap-4 items-center">
          <h2 className="text-lg font-bold text-slate-800 whitespace-nowrap">Global Projects</h2>
          <input 
            type="text" 
            placeholder="Search clients..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="flex-1 max-w-sm border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          />
          {filterAM !== "all" && (
            <button onClick={() => setFilterAM("all")} className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full hover:bg-indigo-100">
              Showing: {filterAM === "unassigned" ? "Unassigned" : accountManagers.find((a:any) => a.id === filterAM)?.name || "Filtered"} ✕
            </button>
          )}
        </div>
        
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase">
            <tr>
              <th className="px-6 py-3 text-left">Client & Deal</th>
              <th className="px-6 py-3 text-left">Assign Account Manager</th>
              <th className="px-6 py-3 text-left">Overall Progress</th>
              <th className="px-6 py-3 text-center">Status</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredProjects.map((p: any) => (
              <tr key={p.id} className="hover:bg-slate-50 transition">
                <td className="px-6 py-4">
                  <div className="font-bold text-slate-900">{p.deal?.lead?.name}</div>
                  <div className="text-xs text-slate-500">{p.deal?.lead?.phone} • <span className="text-purple-600 font-medium">{p.package}</span></div>
                </td>
                <td className="px-6 py-4">
                  <select 
                    value={p.accountManagerId || ""} 
                    onChange={(e) => handleAssignAM(p.id, e.target.value)} 
                    className={`text-sm border rounded-lg px-3 py-1.5 font-medium outline-none focus:ring-2 focus:ring-indigo-500 ${!p.accountManagerId ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-slate-50"}`}
                  >
                    <option value="">⚠️ Unassigned (Select AM)</option>
                    {accountManagers.map((am: any) => (
                      <option key={am.id} value={am.id}>{am.name} ({am.managedProjects?.length || 0} active)</option>
                    ))}
                  </select>
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
                  <span className={`px-2 py-0.5 text-xs font-bold rounded capitalize border ${p.projectStatus === "completed" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : p.projectStatus === "delayed" ? "bg-red-50 text-red-700 border-red-200" : p.projectStatus === "in_progress" ? "bg-blue-50 text-blue-700 border-blue-200" : p.projectStatus === "new" ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-slate-50 text-slate-700 border-slate-200"}`}>
                    {p.projectStatus.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button onClick={() => router.push(`/dashboard/clients/${p.id}`)} className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-medium hover:bg-slate-900 shadow-sm transition flex items-center gap-2 ml-auto">
                    Full Journey <span>→</span>
                  </button>
                </td>
              </tr>
            ))}
            {filteredProjects.length === 0 && (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-sm text-slate-400 italic">No projects found for current filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
