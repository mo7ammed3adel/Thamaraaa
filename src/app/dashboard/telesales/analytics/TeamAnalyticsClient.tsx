"use client";
import { useState, useEffect, useCallback } from "react";
import { PhoneCall, Calendar, Handshake, DollarSign, X, Clock, TrendingUp, ChevronDown } from "lucide-react";
import {
  getTeleSalesAgentAnalytics,
  getTeleSalesTeamAnalytics,
  getTeleSalesTeamDrill,
} from "@/client/api/analytics";
import DateRangeFilter from "@/components/dashboard/DateRangeFilter";
import { useTranslator } from "@/components/i18n/LocaleProvider";

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

type DrillDown = "calls" | "meetings" | "attended" | "deals" | "revenue" | null;

export default function TeamAnalyticsClient() {
  const t = useTranslator();
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
      const data = await getTeleSalesTeamAnalytics({ from: fromDate, to: toDate });
      setAnalytics(data as AgentAnalytics[]);
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
      const data = await getTeleSalesAgentAnalytics({ agentId, from: fromDate, to: toDate });
      setSelectedAgent(data as AgentDetail);
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
    if (!type) return;
    setDrillDown(type);
    setDrillLoading(true);
    try {
      const data = await getTeleSalesTeamDrill({ from: fromDate, to: toDate, drillDown: type });
      setDrillData(data as any[]);
    } catch {
      console.error("Failed to fetch drill-down data");
    }
    setDrillLoading(false);
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
      <DateRangeFilter
        fromDate={fromDate}
        toDate={toDate}
        onFromDateChange={setFromDate}
        onToDateChange={setToDate}
        label="Analytics Date Range"
        description="Filters calls, meetings, deals, and revenue by the selected period."
      />

      {/* Summary Cards - clickable */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div
          onClick={() => toggleDrill("calls")}
          className={`cursor-pointer rounded-xl p-4 text-white shadow-lg transition-all hover:scale-[1.02] ${drillDown === "calls" ? "ring-4 ring-blue-300" : ""} bg-gradient-to-br from-blue-500 to-blue-600`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <PhoneCall className="h-5 w-5 opacity-80" />
              <span className="text-xs font-semibold uppercase opacity-80">{t("metric.totalCalls")}</span>
            </div>
            <ChevronDown className={`h-4 w-4 opacity-60 transition-transform ${drillDown === "calls" ? "rotate-180" : ""}`} />
          </div>
          <p className="text-3xl font-bold">{totals.calls}</p>
        </div>

        <div
          onClick={() => toggleDrill("meetings")}
          className={`cursor-pointer rounded-xl p-4 text-white shadow-lg transition-all hover:scale-[1.02] ${drillDown === "meetings" ? "ring-4 ring-purple-300" : ""} bg-gradient-to-br from-purple-500 to-purple-600`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 opacity-80" />
              <span className="text-xs font-semibold uppercase opacity-80">{t("metric.meetingsBooked")}</span>
            </div>
            <ChevronDown className={`h-4 w-4 opacity-60 transition-transform ${drillDown === "meetings" ? "rotate-180" : ""}`} />
          </div>
          <p className="text-3xl font-bold">{totals.meetings}</p>
        </div>

        <div
          onClick={() => toggleDrill("attended")}
          className={`cursor-pointer rounded-xl p-4 text-white shadow-lg transition-all hover:scale-[1.02] ${drillDown === "attended" ? "ring-4 ring-indigo-300" : ""} bg-gradient-to-br from-indigo-500 to-indigo-600`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 opacity-80" />
              <span className="text-xs font-semibold uppercase opacity-80">{t("status.attended")}</span>
            </div>
            <ChevronDown className={`h-4 w-4 opacity-60 transition-transform ${drillDown === "attended" ? "rotate-180" : ""}`} />
          </div>
          <p className="text-3xl font-bold">{totals.attended}</p>
        </div>

        <div
          onClick={() => toggleDrill("deals")}
          className={`cursor-pointer rounded-xl p-4 text-white shadow-lg transition-all hover:scale-[1.02] ${drillDown === "deals" ? "ring-4 ring-green-300" : ""} bg-gradient-to-br from-green-500 to-green-600`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Handshake className="h-5 w-5 opacity-80" />
              <span className="text-xs font-semibold uppercase opacity-80">{t("metric.dealsClosed")}</span>
            </div>
            <ChevronDown className={`h-4 w-4 opacity-60 transition-transform ${drillDown === "deals" ? "rotate-180" : ""}`} />
          </div>
          <p className="text-3xl font-bold">{totals.deals}</p>
        </div>

        <div
          onClick={() => toggleDrill("revenue")}
          className={`cursor-pointer rounded-xl p-4 text-white shadow-lg transition-all hover:scale-[1.02] ${drillDown === "revenue" ? "ring-4 ring-amber-300" : ""} bg-gradient-to-br from-amber-500 to-amber-600`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 opacity-80" />
              <span className="text-xs font-semibold uppercase opacity-80">{t("finance.revenue")}</span>
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
            drillDown === "calls" ? "bg-blue-50" :
            drillDown === "meetings" ? "bg-purple-50" :
            drillDown === "attended" ? "bg-indigo-50" :
            drillDown === "deals" ? "bg-green-50" :
            "bg-amber-50"
          }`}>
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide flex items-center gap-2">
              {drillDown === "calls" && <><PhoneCall className="h-4 w-4 text-blue-500" /> All Calls</>}
              {drillDown === "meetings" && <><Calendar className="h-4 w-4 text-purple-500" /> Meetings Booked</>}
              {drillDown === "attended" && <><Clock className="h-4 w-4 text-indigo-500" /> Attended Meetings</>}
              {drillDown === "deals" && <><Handshake className="h-4 w-4 text-green-500" /> Deals Closed</>}
              {drillDown === "revenue" && <><DollarSign className="h-4 w-4 text-amber-600" /> Revenue Breakdown</>}
              {!drillLoading && ` (${drillData.length})`}
            </h3>
            <button onClick={() => { setDrillDown(null); setDrillData([]); }} className="text-xs text-gray-500 hover:text-gray-800">{t("common.close")} ✕</button>
          </div>
          <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
            {drillLoading ? (
              <div className="px-6 py-8 text-center">
                <div className="animate-spin h-6 w-6 border-3 border-blue-500 border-t-transparent rounded-full mx-auto" />
              </div>
            ) : drillData.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-gray-500">{t("empty.noData")}</div>
            ) : drillDown === "calls" ? (
              drillData.map((log: any) => (
                <div key={log.id} className="px-6 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-900">{log.lead?.name}</span>
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                        log.callStatus === "Accept and book meeting" ? "bg-green-100 text-green-700" :
                        log.callStatus === "Accept but lost" ? "bg-orange-100 text-orange-700" :
                        log.callStatus === "Busy" ? "bg-yellow-100 text-yellow-700" :
                        "bg-gray-100 text-gray-600"
                      }`}>{log.callStatus}</span>
                      {log.agent && <span className="text-xs text-blue-600">Agent: {log.agent.name}</span>}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{log.notes}</p>
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap shrink-0">{new Date(log.createdAt).toLocaleDateString("en-GB")}</span>
                </div>
              ))
            ) : (drillDown === "meetings" || drillDown === "attended") ? (
              drillData.map((m: any) => (
                <div key={m.id} className="px-6 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                      {m.lead?.name?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{m.lead?.name || "Unknown"}</p>
                      <p className="text-xs text-gray-400">
                        {m.teleAgent ? `TeleSales: ${m.teleAgent.name}` : ""}
                        {m.salesAgent ? ` • Sales: ${m.salesAgent.name}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="text-end">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                      m.status === "Won" ? "bg-green-100 text-green-700" :
                      m.status === "Attended" ? "bg-blue-100 text-blue-700" :
                      m.status === "Lost" ? "bg-red-100 text-red-700" :
                      "bg-gray-100 text-gray-600"
                    }`}>{m.status}</span>
                    <p className="text-xs text-gray-400 mt-1">{m.meetingDate ? new Date(m.meetingDate).toLocaleDateString("en-GB") : ""} {m.meetingTime || ""}</p>
                  </div>
                </div>
              ))
            ) : (drillDown === "deals" || drillDown === "revenue") ? (
              <>
                {drillData.map((d: any) => (
                  <div key={d.id} className="px-6 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{d.lead?.name}</p>
                      <p className="text-xs text-gray-400">
                        {d.lead?.phone} • {d.package}
                        {d.lead?.teleAgent ? ` • TeleSales: ${d.lead.teleAgent.name}` : ""}
                        {d.salesAgent ? ` • Sales: ${d.salesAgent.name}` : ""}
                      </p>
                    </div>
                    <div className="text-end">
                      <p className={`text-sm font-bold ${drillDown === "revenue" ? "text-amber-700" : "text-green-700"}`}>
                        {d.totalAmount?.toLocaleString()} SAR
                      </p>
                      <p className="text-xs text-gray-400">{new Date(d.createdAt).toLocaleDateString("en-GB")}</p>
                    </div>
                  </div>
                ))}
                {drillDown === "revenue" && drillData.length > 0 && (
                  <div className="px-6 py-3 bg-amber-50 flex justify-between items-center">
                    <p className="text-sm font-bold text-gray-900">{t("finance.totalRevenue")}</p>
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
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">{t("analytics.perAgent")}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase">{t("common.agent")}</th>
                <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase">{t("common.specialization")}</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">{t("team.calls")}</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">{t("metric.meetingsBooked")}</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">{t("status.attended")}</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">{t("metric.dealsClosed")}</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">{t("finance.revenueSar")}</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">{t("common.details")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={8} className="px-6 py-8 text-center text-sm text-gray-500">{t("empty.loadingAnalytics")}</td></tr>
              ) : analytics.length === 0 ? (
                <tr><td colSpan={8} className="px-6 py-8 text-center text-sm text-gray-500">{t("empty.noAgents")}</td></tr>
              ) : analytics.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => openAgentDetail(a.id)}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                        {a.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="ms-3">
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
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-blue-50 to-indigo-50">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{selectedAgent.agent.name}</h3>
                    <p className="text-sm text-gray-500">{selectedAgent.agent.email} • {selectedAgent.agent.specialization || "No specialization"}</p>
                  </div>
                  <button onClick={() => setSelectedAgent(null)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded-lg transition-colors">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {/* Calls Section */}
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3 flex items-center gap-2">
                      <PhoneCall className="h-4 w-4 text-blue-500" /> Call Log ({selectedAgent.callLogs.length})
                    </h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {selectedAgent.callLogs.length === 0 ? (
                        <p className="text-sm text-gray-400 py-3">{t("empty.noCalls")}</p>
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
                        <p className="text-sm text-gray-400 py-3">{t("empty.noMeetings")}</p>
                      ) : selectedAgent.meetings.map((m: any) => (
                        <div key={m.id} className="p-3 bg-purple-50 rounded-lg border border-purple-100">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-sm font-medium text-gray-900">{m.lead?.name}</span>
                              <span className={`ms-2 inline-flex px-2 py-0.5 rounded text-xs font-medium ${
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
                        <p className="text-sm text-gray-400 py-3">{t("empty.noDeals")}</p>
                      ) : selectedAgent.deals.map((d: any) => (
                        <div key={d.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-100">
                          <div>
                            <span className="text-sm font-medium text-gray-900">{d.lead?.name}</span>
                            <span className="text-xs text-gray-500 ms-2">{d.lead?.phone}</span>
                            {d.salesAgent && <span className="text-xs text-green-600 ms-2">Sales: {d.salesAgent.name}</span>}
                          </div>
                          <div className="text-end">
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
