"use client";
import { useState, useEffect, useCallback } from "react";
import { Users, Calendar, Handshake, DollarSign, X, TrendingUp, XCircle, Briefcase, ChevronDown } from "lucide-react";

interface AgentAnalytics {
  id: string;
  name: string;
  email: string;
  specialization: string | null;
  status: string;
  totalLeads: number;
  meetingsAttended: number;
  dealsWon: number;
  dealsLost: number;
  revenue: number;
}

interface AgentDetail {
  agent: { id: string; name: string; email: string; specialization: string | null };
  leads: any[];
  meetings: any[];
  deals: any[];
}

type DrillDown = "leads" | "meetings" | "won" | "lost" | "revenue" | null;

export default function SalesTeamAnalyticsClient() {
  const [analytics, setAnalytics] = useState<AgentAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<AgentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [drillDown, setDrillDown] = useState<DrillDown>(null);
  const [drillData, setDrillData] = useState<any[]>([]);
  const [drillLoading, setDrillLoading] = useState(false);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);
      const res = await fetch(`/api/analytics/sales-team?${params.toString()}`);
      if (res.ok) {
        setAnalytics(await res.json());
      }
    } catch {
      console.error("Failed to fetch analytics");
    }
    setLoading(false);
  }, [fromDate, toDate]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const openAgentDetail = async (agentId: string) => {
    setDetailLoading(true);
    try {
      const params = new URLSearchParams({ agentId });
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);
      const res = await fetch(`/api/analytics/sales-agent?${params.toString()}`);
      if (res.ok) {
        setSelectedAgent(await res.json());
      }
    } catch {
      console.error("Failed to fetch agent details");
    }
    setDetailLoading(false);
  };

  const toggleDrill = async (type: DrillDown) => {
    if (drillDown === type) {
      setDrillDown(null);
      setDrillData([]);
      return;
    }
    setDrillDown(type);
    setDrillLoading(true);

    try {
      const params = new URLSearchParams();
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);
      if (type) params.set("drillDown", type);
      const res = await fetch(`/api/analytics/sales-team/drill?${params.toString()}`);
      if (res.ok) {
        setDrillData(await res.json());
      }
    } catch {
      console.error("Failed to fetch drill-down data");
    }
    setDrillLoading(false);
  };

  const totals = analytics.reduce(
    (acc, a) => ({
      leads: acc.leads + a.totalLeads,
      meetings: acc.meetings + a.meetingsAttended,
      won: acc.won + a.dealsWon,
      lost: acc.lost + a.dealsLost,
      revenue: acc.revenue + a.revenue,
    }),
    { leads: 0, meetings: 0, won: 0, lost: 0, revenue: 0 }
  );

  return (
    <div className="space-y-6">
      {/* Date Filter */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">From Date</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">To Date</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
          />
        </div>
        <button
          onClick={() => { setFromDate(""); setToDate(""); }}
          className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          Reset Filter
        </button>
      </div>

      {/* Summary Cards - clickable */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div
          onClick={() => toggleDrill("leads")}
          className={`cursor-pointer rounded-xl p-4 text-white shadow-lg transition-all hover:scale-[1.02] ${drillDown === "leads" ? "ring-4 ring-slate-300" : ""} bg-gradient-to-br from-slate-600 to-slate-700`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 opacity-80" />
              <span className="text-xs font-semibold uppercase opacity-80">Total Leads</span>
            </div>
            <ChevronDown className={`h-4 w-4 opacity-60 transition-transform ${drillDown === "leads" ? "rotate-180" : ""}`} />
          </div>
          <p className="text-3xl font-bold">{totals.leads}</p>
        </div>

        <div
          onClick={() => toggleDrill("meetings")}
          className={`cursor-pointer rounded-xl p-4 text-white shadow-lg transition-all hover:scale-[1.02] ${drillDown === "meetings" ? "ring-4 ring-indigo-300" : ""} bg-gradient-to-br from-indigo-500 to-indigo-600`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 opacity-80" />
              <span className="text-xs font-semibold uppercase opacity-80">Meetings</span>
            </div>
            <ChevronDown className={`h-4 w-4 opacity-60 transition-transform ${drillDown === "meetings" ? "rotate-180" : ""}`} />
          </div>
          <p className="text-3xl font-bold">{totals.meetings}</p>
        </div>

        <div
          onClick={() => toggleDrill("won")}
          className={`cursor-pointer rounded-xl p-4 text-white shadow-lg transition-all hover:scale-[1.02] ${drillDown === "won" ? "ring-4 ring-green-300" : ""} bg-gradient-to-br from-green-500 to-green-600`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Handshake className="h-5 w-5 opacity-80" />
              <span className="text-xs font-semibold uppercase opacity-80">Deals Won</span>
            </div>
            <ChevronDown className={`h-4 w-4 opacity-60 transition-transform ${drillDown === "won" ? "rotate-180" : ""}`} />
          </div>
          <p className="text-3xl font-bold">{totals.won}</p>
        </div>

        <div
          onClick={() => toggleDrill("lost")}
          className={`cursor-pointer rounded-xl p-4 text-white shadow-lg transition-all hover:scale-[1.02] ${drillDown === "lost" ? "ring-4 ring-red-300" : ""} bg-gradient-to-br from-red-500 to-red-600`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 opacity-80" />
              <span className="text-xs font-semibold uppercase opacity-80">Deals Lost</span>
            </div>
            <ChevronDown className={`h-4 w-4 opacity-60 transition-transform ${drillDown === "lost" ? "rotate-180" : ""}`} />
          </div>
          <p className="text-3xl font-bold">{totals.lost}</p>
        </div>

        <div
          onClick={() => toggleDrill("revenue")}
          className={`cursor-pointer rounded-xl p-4 text-white shadow-lg transition-all hover:scale-[1.02] ${drillDown === "revenue" ? "ring-4 ring-amber-300" : ""} bg-gradient-to-br from-amber-500 to-amber-600`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 opacity-80" />
              <span className="text-xs font-semibold uppercase opacity-80">Revenue</span>
            </div>
            <ChevronDown className={`h-4 w-4 opacity-60 transition-transform ${drillDown === "revenue" ? "rotate-180" : ""}`} />
          </div>
          <p className="text-3xl font-bold">{totals.revenue.toLocaleString()}</p>
        </div>
      </div>

      {/* Drill-Down Panels */}
      {drillDown && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className={`px-6 py-4 border-b border-gray-200 flex justify-between items-center ${
            drillDown === "leads" ? "bg-slate-50" :
            drillDown === "meetings" ? "bg-indigo-50" :
            drillDown === "won" ? "bg-green-50" :
            drillDown === "lost" ? "bg-red-50" :
            "bg-amber-50"
          }`}>
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide flex items-center gap-2">
              {drillDown === "leads" && <><Briefcase className="h-4 w-4 text-slate-500" /> All Leads</>}
              {drillDown === "meetings" && <><Calendar className="h-4 w-4 text-indigo-500" /> All Meetings</>}
              {drillDown === "won" && <><TrendingUp className="h-4 w-4 text-green-500" /> Deals Won</>}
              {drillDown === "lost" && <><XCircle className="h-4 w-4 text-red-500" /> Deals Lost</>}
              {drillDown === "revenue" && <><DollarSign className="h-4 w-4 text-amber-600" /> Revenue Breakdown</>}
              {!drillLoading && ` (${drillData.length})`}
            </h3>
            <button onClick={() => { setDrillDown(null); setDrillData([]); }} className="text-xs text-gray-500 hover:text-gray-800">Close ✕</button>
          </div>
          <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
            {drillLoading ? (
              <div className="px-6 py-8 text-center">
                <div className="animate-spin h-6 w-6 border-3 border-blue-500 border-t-transparent rounded-full mx-auto" />
              </div>
            ) : drillData.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-gray-500">No data found for this period.</div>
            ) : drillDown === "leads" ? (
              drillData.map((lead: any) => (
                <div key={lead.id} className="px-6 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-slate-500 to-slate-600 flex items-center justify-center text-white text-xs font-bold">
                      {lead.name?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{lead.name}</p>
                      <p className="text-xs text-gray-400">{lead.phone} {lead.salesAgent ? `• Agent: ${lead.salesAgent.name}` : ""}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                      lead.classification === "Hot" ? "bg-red-100 text-red-700" :
                      lead.classification === "Warm" ? "bg-amber-100 text-amber-700" :
                      "bg-blue-100 text-blue-700"
                    }`}>{lead.classification}</span>
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                      lead.status === "Closed_Won" ? "bg-green-100 text-green-700" :
                      lead.status === "Closed_Lost" ? "bg-red-100 text-red-700" :
                      "bg-blue-100 text-blue-700"
                    }`}>{lead.status?.replace(/_/g, " ")}</span>
                  </div>
                </div>
              ))
            ) : drillDown === "meetings" ? (
              drillData.map((m: any) => (
                <div key={m.id} className="px-6 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                      {m.lead?.name?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{m.lead?.name || "Unknown"}</p>
                      <p className="text-xs text-gray-400">{m.salesAgent ? `Agent: ${m.salesAgent.name}` : ""} {m.teleAgent ? `• TeleSales: ${m.teleAgent.name}` : ""}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                      m.status === "Attended" || m.status === "Won" ? "bg-green-100 text-green-700" :
                      m.status === "Lost" ? "bg-red-100 text-red-700" :
                      "bg-blue-100 text-blue-700"
                    }`}>{m.status}</span>
                    <p className="text-xs text-gray-400 mt-1">{m.meetingDate ? new Date(m.meetingDate).toLocaleDateString("en-GB") : ""} {m.meetingTime || ""}</p>
                  </div>
                </div>
              ))
            ) : (drillDown === "won" || drillDown === "lost" || drillDown === "revenue") ? (
              <>
                {drillData.map((deal: any) => (
                  <div key={deal.id} className="px-6 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{deal.lead?.name}</p>
                      <p className="text-xs text-gray-400">{deal.lead?.phone} • {deal.package} {deal.salesAgent ? `• Agent: ${deal.salesAgent.name}` : ""}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${drillDown === "lost" ? "text-red-600" : drillDown === "revenue" ? "text-amber-700" : "text-green-700"}`}>
                        {deal.totalAmount?.toLocaleString()} SAR
                      </p>
                      <p className="text-xs text-gray-400">{new Date(deal.createdAt).toLocaleDateString("en-GB")}</p>
                    </div>
                  </div>
                ))}
                {drillDown === "revenue" && drillData.length > 0 && (
                  <div className="px-6 py-3 bg-amber-50 flex justify-between items-center">
                    <p className="text-sm font-bold text-gray-900">Total Revenue</p>
                    <p className="text-lg font-bold text-amber-700">{totals.revenue.toLocaleString()} SAR</p>
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* Agents Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Per-Agent Performance</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Agent</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Specialization</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Leads</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Meetings</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Deals Won</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Deals Lost</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Revenue (SAR)</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={8} className="px-6 py-8 text-center text-sm text-gray-500">Loading analytics...</td></tr>
              ) : analytics.length === 0 ? (
                <tr><td colSpan={8} className="px-6 py-8 text-center text-sm text-gray-500">No agent data found.</td></tr>
              ) : analytics.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => openAgentDetail(a.id)}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white text-xs font-bold">
                        {a.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-semibold text-gray-900">{a.name}</p>
                        <p className="text-xs text-gray-400">{a.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {a.specialization ? (
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        a.specialization === "Hot" ? "bg-red-100 text-red-700" :
                        a.specialization === "Warm" ? "bg-amber-100 text-amber-700" :
                        "bg-blue-100 text-blue-700"
                      }`}>
                        {a.specialization === "Hot" ? "🔥" : a.specialization === "Warm" ? "☀️" : "❄️"} {a.specialization}
                      </span>
                    ) : <span className="text-xs text-gray-400">—</span>}
                  </td>
                  <td className="px-6 py-4 text-center text-sm font-semibold text-gray-900">{a.totalLeads}</td>
                  <td className="px-6 py-4 text-center text-sm font-semibold text-indigo-600">{a.meetingsAttended}</td>
                  <td className="px-6 py-4 text-center text-sm font-semibold text-green-600">{a.dealsWon}</td>
                  <td className="px-6 py-4 text-center text-sm font-semibold text-red-600">{a.dealsLost}</td>
                  <td className="px-6 py-4 text-center text-sm font-bold text-amber-600">{a.revenue.toLocaleString()}</td>
                  <td className="px-6 py-4 text-center">
                    <button className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors">
                      <TrendingUp className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Agent Detail Popup */}
      {(selectedAgent || detailLoading) && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => !detailLoading && setSelectedAgent(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            {detailLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin h-8 w-8 border-4 border-green-500 border-t-transparent rounded-full" />
              </div>
            ) : selectedAgent && (
              <>
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-green-50 to-emerald-50">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{selectedAgent.agent.name}</h3>
                    <p className="text-sm text-gray-500">{selectedAgent.agent.email} • {selectedAgent.agent.specialization || "No specialization"}</p>
                  </div>
                  <button onClick={() => setSelectedAgent(null)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded-lg transition-colors">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {/* Leads Section */}
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3 flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-slate-500" /> Leads ({selectedAgent.leads.length})
                    </h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {selectedAgent.leads.length === 0 ? (
                        <p className="text-sm text-gray-400 py-3">No leads found for this period.</p>
                      ) : selectedAgent.leads.map((lead: any) => (
                        <div key={lead.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                          <div>
                            <span className="text-sm font-medium text-gray-900">{lead.name}</span>
                            <span className="text-xs text-gray-500 ml-2">{lead.phone}</span>
                            <span className={`ml-2 inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                              lead.classification === "Hot" ? "bg-red-100 text-red-700" :
                              lead.classification === "Warm" ? "bg-amber-100 text-amber-700" :
                              "bg-blue-100 text-blue-700"
                            }`}>{lead.classification}</span>
                          </div>
                          <div>
                            <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                              lead.status === "Closed_Won" ? "bg-green-100 text-green-700" :
                              lead.status === "Closed_Lost" ? "bg-red-100 text-red-700" :
                              "bg-blue-100 text-blue-700"
                            }`}>{lead.status.replace(/_/g, " ")}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Meetings Section */}
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3 flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-indigo-500" /> Meetings ({selectedAgent.meetings.length})
                    </h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {selectedAgent.meetings.length === 0 ? (
                        <p className="text-sm text-gray-400 py-3">No meetings found for this period.</p>
                      ) : selectedAgent.meetings.map((m: any) => (
                        <div key={m.id} className="p-3 bg-indigo-50 rounded-lg border border-indigo-100">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-sm font-medium text-gray-900">{m.lead?.name}</span>
                              <span className={`ml-2 inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                                m.status === "Won" ? "bg-green-100 text-green-700" :
                                m.status === "Attended" ? "bg-blue-100 text-blue-700" :
                                m.status === "Lost" ? "bg-red-100 text-red-700" :
                                "bg-gray-100 text-gray-600"
                              }`}>{m.status}</span>
                            </div>
                            <span className="text-xs text-gray-400">{new Date(m.meetingDate).toLocaleDateString("en-GB")} {m.meetingTime || ""}</span>
                          </div>
                          {m.teleAgent && (
                            <p className="text-xs text-indigo-600 mt-1">TeleSales: {m.teleAgent.name}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Deals Section */}
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3 flex items-center gap-2">
                      <Handshake className="h-4 w-4 text-green-500" /> Deals ({selectedAgent.deals.length})
                    </h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {selectedAgent.deals.length === 0 ? (
                        <p className="text-sm text-gray-400 py-3">No deals found for this period.</p>
                      ) : selectedAgent.deals.map((d: any) => (
                        <div key={d.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-100">
                          <div>
                            <span className="text-sm font-medium text-gray-900">{d.lead?.name}</span>
                            <span className="text-xs text-gray-500 ml-2">{d.lead?.phone}</span>
                            <span className={`ml-2 inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                              d.status === "Closed_Won" || d.status === "Pending" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                            }`}>{d.status.replace(/_/g, " ")}</span>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-green-700">{d.totalAmount.toLocaleString()} SAR</p>
                            <p className="text-xs text-gray-400">{new Date(d.createdAt).toLocaleDateString("en-GB")}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
