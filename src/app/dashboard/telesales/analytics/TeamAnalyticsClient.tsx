"use client";
import { useState, useEffect, useCallback } from "react";
import { PhoneCall, Calendar, Handshake, DollarSign, X, Clock, TrendingUp } from "lucide-react";

interface AgentAnalytics {
  id: string;
  name: string;
  email: string;
  specialization: string | null;
  status: string;
  totalCalls: number;
  meetingsBooked: number;
  meetingsAttended: number;
  dealsClosed: number;
  revenue: number;
}

interface AgentDetail {
  agent: { id: string; name: string; email: string; specialization: string | null };
  callLogs: any[];
  meetings: any[];
  deals: any[];
}

export default function TeamAnalyticsClient() {
  const [analytics, setAnalytics] = useState<AgentAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<AgentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);
      const res = await fetch(`/api/analytics/team?${params.toString()}`);
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
      const res = await fetch(`/api/analytics/agent?${params.toString()}`);
      if (res.ok) {
        setSelectedAgent(await res.json());
      }
    } catch {
      console.error("Failed to fetch agent details");
    }
    setDetailLoading(false);
  };

  const totals = analytics.reduce(
    (acc, a) => ({
      calls: acc.calls + a.totalCalls,
      meetings: acc.meetings + a.meetingsBooked,
      attended: acc.attended + a.meetingsAttended,
      deals: acc.deals + a.dealsClosed,
      revenue: acc.revenue + a.revenue,
    }),
    { calls: 0, meetings: 0, attended: 0, deals: 0, revenue: 0 }
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
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">To Date</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <button
          onClick={() => { setFromDate(""); setToDate(""); }}
          className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          Reset Filter
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <PhoneCall className="h-5 w-5 opacity-80" />
            <span className="text-xs font-semibold uppercase opacity-80">Total Calls</span>
          </div>
          <p className="text-3xl font-bold">{totals.calls}</p>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="h-5 w-5 opacity-80" />
            <span className="text-xs font-semibold uppercase opacity-80">Meetings Booked</span>
          </div>
          <p className="text-3xl font-bold">{totals.meetings}</p>
        </div>
        <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl p-4 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-5 w-5 opacity-80" />
            <span className="text-xs font-semibold uppercase opacity-80">Attended</span>
          </div>
          <p className="text-3xl font-bold">{totals.attended}</p>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <Handshake className="h-5 w-5 opacity-80" />
            <span className="text-xs font-semibold uppercase opacity-80">Deals Closed</span>
          </div>
          <p className="text-3xl font-bold">{totals.deals}</p>
        </div>
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-4 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-5 w-5 opacity-80" />
            <span className="text-xs font-semibold uppercase opacity-80">Revenue</span>
          </div>
          <p className="text-3xl font-bold">{totals.revenue.toLocaleString()}</p>
        </div>
      </div>

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
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Calls</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Meetings Booked</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Attended</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Deals Closed</th>
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
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
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
                  <td className="px-6 py-4 text-center text-sm font-semibold text-gray-900">{a.totalCalls}</td>
                  <td className="px-6 py-4 text-center text-sm font-semibold text-purple-600">{a.meetingsBooked}</td>
                  <td className="px-6 py-4 text-center text-sm font-semibold text-indigo-600">{a.meetingsAttended}</td>
                  <td className="px-6 py-4 text-center text-sm font-semibold text-green-600">{a.dealsClosed}</td>
                  <td className="px-6 py-4 text-center text-sm font-bold text-amber-600">{a.revenue.toLocaleString()}</td>
                  <td className="px-6 py-4 text-center">
                    <button className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
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
                <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
              </div>
            ) : selectedAgent && (
              <>
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-blue-50 to-indigo-50">
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
                  {/* Calls Section */}
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3 flex items-center gap-2">
                      <PhoneCall className="h-4 w-4 text-blue-500" /> Call Log ({selectedAgent.callLogs.length})
                    </h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {selectedAgent.callLogs.length === 0 ? (
                        <p className="text-sm text-gray-400 py-3">No call logs found for this period.</p>
                      ) : selectedAgent.callLogs.map((log: any) => (
                        <div key={log.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-900">{log.lead?.name}</span>
                              <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                                log.callStatus === "Meeting Booked" ? "bg-green-100 text-green-700" :
                                log.callStatus === "Answered" ? "bg-blue-100 text-blue-700" :
                                "bg-gray-100 text-gray-600"
                              }`}>{log.callStatus}</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">{log.notes}</p>
                          </div>
                          <span className="text-xs text-gray-400 whitespace-nowrap">{new Date(log.createdAt).toLocaleDateString("en-GB")}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Meetings Section */}
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3 flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-purple-500" /> Meetings ({selectedAgent.meetings.length})
                    </h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {selectedAgent.meetings.length === 0 ? (
                        <p className="text-sm text-gray-400 py-3">No meetings found for this period.</p>
                      ) : selectedAgent.meetings.map((m: any) => (
                        <div key={m.id} className="p-3 bg-purple-50 rounded-lg border border-purple-100">
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
                          {m.salesAgent && (
                            <p className="text-xs text-purple-600 mt-1">Sales: {m.salesAgent.name}</p>
                          )}
                          {m.salesNotes && (
                            <p className="text-xs text-gray-500 mt-1 italic">"{m.salesNotes}"</p>
                          )}
                          {m.summary && (
                            <p className="text-xs text-gray-600 mt-1">Summary: {m.summary}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Deals Section */}
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3 flex items-center gap-2">
                      <Handshake className="h-4 w-4 text-green-500" /> Deals Closed ({selectedAgent.deals.length})
                    </h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {selectedAgent.deals.length === 0 ? (
                        <p className="text-sm text-gray-400 py-3">No deals found for this period.</p>
                      ) : selectedAgent.deals.map((d: any) => (
                        <div key={d.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-100">
                          <div>
                            <span className="text-sm font-medium text-gray-900">{d.lead?.name}</span>
                            <span className="text-xs text-gray-500 ml-2">{d.lead?.phone}</span>
                            {d.salesAgent && <span className="text-xs text-green-600 ml-2">Sales: {d.salesAgent.name}</span>}
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
