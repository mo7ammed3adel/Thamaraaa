"use client";

import { useState } from "react";
<<<<<<< HEAD
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
=======
import { 
  BarChart, Users, AlertTriangle, Briefcase, UserPlus, FileText, 
  Settings, CheckCircle, Clock, AlertCircle, ChevronRight, Activity, PieChart
} from "lucide-react";

type Tab = "overview" | "incoming" | "managers" | "clients" | "technical" | "warnings" | "analytics";

export default function HeadAccountManagerClient() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  // Placeholder data for UI demonstration
  const stats = [
    { name: "Active Clients", value: "45", icon: Briefcase, color: "bg-blue-500" },
    { name: "Incoming Pending", value: "7", icon: UserPlus, color: "bg-orange-500" },
    { name: "Assigned Clients", value: "38", icon: CheckCircle, color: "bg-emerald-500" },
    { name: "Unassigned Clients", value: "7", icon: Clock, color: "bg-amber-500" },
    { name: "Active Warnings", value: "3", icon: AlertTriangle, color: "bg-red-500" },
  ];

  const incomingClients = [
    { id: 1, name: "Tech Solutions Inc.", package: "Full", value: "$5,000", date: "2026-04-01", salesAgent: "Ahmed", status: "Pending" },
    { id: 2, name: "Global Marketing", package: "SEO", value: "$2,000", date: "2026-04-02", salesAgent: "Sara", status: "Pending" },
  ];

  const accountManagers = [
    { id: 1, name: "Khaled Ali", totalClients: 15, activeClients: 12, warnings: 1, lastActivity: "2 hours ago" },
    { id: 2, name: "Nour Kamal", totalClients: 23, activeClients: 20, warnings: 2, lastActivity: "5 mins ago" },
  ];

  const renderTabNavigation = () => (
    <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg mb-6 overflow-x-auto">
      {[
        { id: "overview", label: "Overview", icon: BarChart },
        { id: "incoming", label: "Incoming Clients", icon: UserPlus },
        { id: "managers", label: "My AMs", icon: Users },
        { id: "clients", label: "All Clients", icon: Briefcase },
        { id: "technical", label: "Technical Assignment", icon: Settings },
        { id: "warnings", label: "Warnings", icon: AlertTriangle },
        { id: "analytics", label: "Analytics", icon: PieChart },
      ].map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id as Tab)}
          className={`flex items-center px-4 py-2.5 text-sm font-medium rounded-md whitespace-nowrap transition-colors ${
            activeTab === tab.id
              ? "bg-white text-blue-700 shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-200"
          }`}
        >
          <tab.icon className="w-4 h-4 mr-2" />
          {tab.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Head Account Manager Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage your account managers, distribute incoming clients, and monitor service delivery.
        </p>
      </div>

      {renderTabNavigation()}

      {/* OVERVIEW TAB */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {stats.map((stat) => (
              <div key={stat.name} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex items-center">
                <div className={`${stat.color} p-3 rounded-lg text-white mr-4`}>
                  <stat.icon className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">{stat.name}</p>
                  <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h3>
            <div className="flex gap-4">
              <button 
                onClick={() => setActiveTab("incoming")}
                className="bg-blue-50 text-blue-600 hover:bg-blue-100 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Assign Incoming Clients ({stats[1].value})
              </button>
              <button 
                onClick={() => setActiveTab("warnings")}
                className="bg-red-50 text-red-600 hover:bg-red-100 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Review Warnings ({stats[4].value})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INCOMING CLIENTS TAB */}
      {activeTab === "incoming" && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-200 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-slate-900">Incoming Clients (Unassigned)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-600 uppercase text-xs">
                <tr>
                  <th className="px-6 py-4 font-medium">Client Name</th>
                  <th className="px-6 py-4 font-medium">Package</th>
                  <th className="px-6 py-4 font-medium">Value</th>
                  <th className="px-6 py-4 font-medium">Closing Date</th>
                  <th className="px-6 py-4 font-medium">Sales Agent</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {incomingClients.map((client) => (
                  <tr key={client.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-900">{client.name}</td>
                    <td className="px-6 py-4 text-slate-600">
                      <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md text-xs font-medium">
                        {client.package}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{client.value}</td>
                    <td className="px-6 py-4 text-slate-600">{client.date}</td>
                    <td className="px-6 py-4 text-slate-600">{client.salesAgent}</td>
                    <td className="px-6 py-4">
                      <span className="bg-amber-50 text-amber-700 px-2.5 py-1 rounded-md text-xs font-medium flex items-center w-fit">
                        <Clock className="w-3 h-3 mr-1" />
                        {client.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="bg-blue-600 text-white px-3 py-1.5 rounded-md text-xs font-medium hover:bg-blue-700 transition">
                        Assign AM
                      </button>
                    </td>
                  </tr>
                ))}
                {incomingClients.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                      No incoming clients waiting for assignment.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MANAGERS TAB */}
      {activeTab === "managers" && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900">My Account Managers</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 p-6 gap-6">
            {accountManagers.map(am => (
              <div key={am.id} className="border border-slate-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-100 text-blue-700 w-10 h-10 rounded-full flex items-center justify-center font-bold">
                      {am.name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900">{am.name}</h4>
                      <p className="text-xs text-slate-500">Last seen: {am.lastActivity}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                </div>
                
                <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                  <div className="bg-slate-50 p-2 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">Total</p>
                    <p className="font-semibold text-slate-900">{am.totalClients}</p>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">Active</p>
                    <p className="font-semibold text-emerald-600">{am.activeClients}</p>
                  </div>
                  <div className="bg-red-50 p-2 rounded-lg">
                    <p className="text-xs text-red-500 mb-1">Warnings</p>
                    <p className="font-semibold text-red-600">{am.warnings}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PLACEHOLDERS FOR OTHER TABS FOR NOW TO AVOID MASSIVE FILE SIZES, CAN EXPAND BASED ON REQUIREMENTS */}
      {["clients", "technical", "warnings", "analytics"].includes(activeTab) && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <Activity className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 capitalize">{activeTab} Interface</h3>
          <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">
            This section represents the {activeTab} view as per the Head Account Manager specifications. Data connections would be implemented here to show detailed records.
          </p>
        </div>
      )}
>>>>>>> bb12de6 (Update Head Account Manager dashboard)
    </div>
  );
}
