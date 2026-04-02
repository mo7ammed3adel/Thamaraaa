"use client";

import { useState } from "react";

export default function ChiefSalesClient({ deals, salesTeam, warnings, projects, kpis }: any) {
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [pipelineView, setPipelineView] = useState<"kanban" | "table">("kanban");

  const pipelineStages = [
    { key: "leads", label: "Leads", color: "bg-blue-500", items: projects.filter((p: any) => p.projectStatus === "new") },
    { key: "sales", label: "In Sales", color: "bg-purple-500", items: projects.filter((p: any) => p.projectStatus === "setup") },
    { key: "accounts", label: "In Accounts", color: "bg-amber-500", items: projects.filter((p: any) => ["assigned", "in_progress"].includes(p.projectStatus)) },
    { key: "operations", label: "Operations", color: "bg-emerald-500", items: projects.filter((p: any) => p.projectStatus === "completed") },
  ];

  return (
    <div className="space-y-8">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-5 text-white shadow-lg shadow-emerald-200">
          <p className="text-sm font-medium text-emerald-100">Total Revenue Today</p>
          <p className="text-3xl font-bold mt-1">{kpis.totalRevenueToday.toLocaleString()} <span className="text-lg">EGP</span></p>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-5 text-white shadow-lg shadow-blue-200">
          <p className="text-sm font-medium text-blue-100">Closed Deals Today</p>
          <p className="text-3xl font-bold mt-1">{kpis.closedDealsToday}</p>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-5 text-white shadow-lg shadow-purple-200">
          <p className="text-sm font-medium text-purple-100">Pipeline Value</p>
          <p className="text-3xl font-bold mt-1">{kpis.pipelineValue.toLocaleString()} <span className="text-lg">EGP</span></p>
        </div>
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-5 text-white shadow-lg shadow-amber-200">
          <p className="text-sm font-medium text-amber-100">Total Deals</p>
          <p className="text-3xl font-bold mt-1">{kpis.totalDeals}</p>
        </div>
      </div>

      {/* Sales Pipeline Kanban */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-800">Sales Pipeline</h2>
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
            <button onClick={() => setPipelineView("kanban")} className={`px-3 py-1 text-xs font-medium rounded-md transition ${pipelineView === "kanban" ? "bg-white shadow text-slate-700" : "text-slate-500"}`}>Kanban</button>
            <button onClick={() => setPipelineView("table")} className={`px-3 py-1 text-xs font-medium rounded-md transition ${pipelineView === "table" ? "bg-white shadow text-slate-700" : "text-slate-500"}`}>Table</button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          {pipelineStages.map((stage) => (
            <div key={stage.key} className="bg-slate-50 rounded-xl p-4 border">
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-2.5 h-2.5 rounded-full ${stage.color}`} />
                <h3 className="text-sm font-bold text-slate-700">{stage.label}</h3>
                <span className="ml-auto text-xs font-medium text-slate-400 bg-white px-2 py-0.5 rounded-full">{stage.items.length}</span>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {stage.items.map((item: any) => (
                  <div key={item.id} className="bg-white rounded-lg p-3 border shadow-sm hover:shadow-md transition cursor-pointer">
                    <p className="text-sm font-semibold text-slate-800">{item.deal?.lead?.name || "Unknown"}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{item.package} • {item.deal?.totalAmount?.toLocaleString()} EGP</p>
                  </div>
                ))}
                {stage.items.length === 0 && <p className="text-xs text-slate-400 italic text-center py-4">No items</p>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Team Performance Table */}
      <div>
        <h2 className="text-lg font-bold text-slate-800 mb-4">Team Performance (Today)</h2>
        <div className="bg-white rounded-xl shadow border overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Role</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Calls Today</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Meetings</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Closed Deals</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {salesTeam.map((agent: any) => {
                const revenue = agent.salesDeals?.reduce((s: number, d: any) => s + d.totalAmount, 0) || 0;
                return (
                  <tr key={agent.id} className="hover:bg-slate-50/50 cursor-pointer transition" onClick={() => setSelectedAgent(selectedAgent?.id === agent.id ? null : agent)}>
                    <td className="px-6 py-4 text-sm font-bold text-slate-900">{agent.name}</td>
                    <td className="px-6 py-4 text-sm text-slate-500 capitalize">{agent.role.replace(/_/g, " ")}</td>
                    <td className="px-6 py-4 text-sm text-center font-medium">{agent.callLogs?.length || 0}</td>
                    <td className="px-6 py-4 text-sm text-center font-medium">{agent.meetingsAsSales?.length || 0}</td>
                    <td className="px-6 py-4 text-sm text-center font-bold text-emerald-700">{agent.salesDeals?.length || 0}</td>
                    <td className="px-6 py-4 text-sm text-right font-bold text-emerald-700">{revenue.toLocaleString()} EGP</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Active Warnings */}
      {warnings.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-slate-800 mb-4">Recent Warnings</h2>
          <div className="space-y-2">
            {warnings.map((w: any) => (
              <div key={w.id} className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
                <span className="text-lg">🚨</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-800">{w.message}</p>
                  <p className="text-xs text-red-500 mt-0.5 capitalize">{w.senderRole.replace(/_/g, " ")} • {new Date(w.createdAt).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
