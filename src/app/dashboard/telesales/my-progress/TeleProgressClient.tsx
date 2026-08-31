"use client";
import { useState, useEffect, useCallback } from "react";
import { PhoneCall, Calendar, PhoneOff, PhoneMissed, CheckCircle2, XCircle, Clock, ChevronDown } from "lucide-react";
import { getMyProgress } from "@/client/api/analytics";
import DateRangeFilter from "@/components/dashboard/DateRangeFilter";
import { useTranslator } from "@/components/i18n/LocaleProvider";

interface TeleProgress {
  role: string;
  totalLeads: number;
  totalCalls: number;
  acceptButLost: number;
  acceptAndBook: number;
  busy: number;
  wrongNumber: number;
  meetingsBooked: number;
  callLogs: any[];
}

type DrillDown = "calls" | "booked" | "lost" | "busy" | "meetings" | null;

export default function TeleProgressClient() {
  const t = useTranslator();
  const [data, setData] = useState<TeleProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [drillDown, setDrillDown] = useState<DrillDown>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMyProgress({ from: fromDate, to: toDate });
      setData(data as TeleProgress);
    } catch {
      console.error("Failed to fetch progress");
    }
    setLoading(false);
  }, [fromDate, toDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleDrill = (d: DrillDown) => setDrillDown(drillDown === d ? null : d);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!data) return null;

  const conversionRate = data.totalCalls > 0
    ? ((data.acceptAndBook / data.totalCalls) * 100).toFixed(1)
    : "0.0";

  // Filter call logs based on drill-down selection
  const getDrillLogs = () => {
    if (!data) return [];
    switch (drillDown) {
      case "calls": return data.callLogs;
      case "booked": return data.callLogs.filter(c => c.callStatus === "Accept and book meeting");
      case "lost": return data.callLogs.filter(c => c.callStatus === "Accept but lost");
      case "busy": return data.callLogs.filter(c => c.callStatus === "Busy" || c.callStatus === "Wrong Number");
      default: return [];
    }
  };

  const drillLogs = getDrillLogs();

  return (
    <div className="space-y-6">
      <DateRangeFilter
        fromDate={fromDate}
        toDate={toDate}
        onFromDateChange={setFromDate}
        onToDateChange={setToDate}
        label="Progress Date Range"
        description="Filters your telesales progress by the selected period."
      />

      {/* Summary Cards - clickable */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
          <p className="text-3xl font-bold">{data.totalCalls}</p>
          <p className="text-xs opacity-70 mt-1">{data.totalLeads} leads assigned</p>
        </div>

        <div
          onClick={() => toggleDrill("booked")}
          className={`cursor-pointer rounded-xl p-4 text-white shadow-lg transition-all hover:scale-[1.02] ${drillDown === "booked" ? "ring-4 ring-green-300" : ""} bg-gradient-to-br from-green-500 to-emerald-600`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 opacity-80" />
              <span className="text-xs font-semibold uppercase opacity-80">{t("progress.acceptBook")}</span>
            </div>
            <ChevronDown className={`h-4 w-4 opacity-60 transition-transform ${drillDown === "booked" ? "rotate-180" : ""}`} />
          </div>
          <p className="text-3xl font-bold">{data.acceptAndBook}</p>
          <p className="text-xs opacity-70 mt-1">{conversionRate}% conversion rate</p>
        </div>

        <div
          onClick={() => toggleDrill("lost")}
          className={`cursor-pointer rounded-xl p-4 text-white shadow-lg transition-all hover:scale-[1.02] ${drillDown === "lost" ? "ring-4 ring-orange-300" : ""} bg-gradient-to-br from-orange-500 to-orange-600`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 opacity-80" />
              <span className="text-xs font-semibold uppercase opacity-80">{t("progress.acceptLost")}</span>
            </div>
            <ChevronDown className={`h-4 w-4 opacity-60 transition-transform ${drillDown === "lost" ? "rotate-180" : ""}`} />
          </div>
          <p className="text-3xl font-bold">{data.acceptButLost}</p>
        </div>

        <div
          onClick={() => toggleDrill("busy")}
          className={`cursor-pointer rounded-xl p-4 text-white shadow-lg transition-all hover:scale-[1.02] ${drillDown === "busy" ? "ring-4 ring-slate-300" : ""} bg-gradient-to-br from-slate-500 to-slate-600`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <PhoneOff className="h-5 w-5 opacity-80" />
              <span className="text-xs font-semibold uppercase opacity-80">Busy</span>
            </div>
            <ChevronDown className={`h-4 w-4 opacity-60 transition-transform ${drillDown === "busy" ? "rotate-180" : ""}`} />
          </div>
          <p className="text-3xl font-bold">{data.busy}</p>
          <p className="text-xs opacity-70 mt-1">{data.wrongNumber} wrong numbers</p>
        </div>
      </div>

      {/* Secondary Stats - clickable */}
      <div className="grid grid-cols-2 gap-4">
        <div
          onClick={() => toggleDrill("meetings")}
          className={`cursor-pointer bg-white rounded-xl border p-4 shadow-sm transition-all hover:scale-[1.01] ${drillDown === "meetings" ? "ring-2 ring-purple-400 border-purple-200" : "border-purple-100"}`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-50 rounded-lg">
              <Calendar className="h-5 w-5 text-purple-500" />
            </div>
            <div className="flex-1">
              <p className="text-2xl font-bold text-purple-600">{data.meetingsBooked}</p>
              <p className="text-xs text-gray-500">{t("metric.meetingsBooked")}</p>
            </div>
            <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${drillDown === "meetings" ? "rotate-180" : ""}`} />
          </div>
        </div>
        <div className="bg-white rounded-xl border border-yellow-100 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-50 rounded-lg">
              <PhoneMissed className="h-5 w-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-600">{data.wrongNumber}</p>
              <p className="text-xs text-gray-500">{t("progress.wrongNumbers")}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Drill-Down Panel */}
      {drillDown && drillDown !== "meetings" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className={`px-6 py-4 border-b border-gray-200 flex justify-between items-center ${
            drillDown === "calls" ? "bg-blue-50" :
            drillDown === "booked" ? "bg-green-50" :
            drillDown === "lost" ? "bg-orange-50" :
            "bg-slate-50"
          }`}>
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide flex items-center gap-2">
              {drillDown === "calls" && <><PhoneCall className="h-4 w-4 text-blue-500" /> All Calls</>}
              {drillDown === "booked" && <><CheckCircle2 className="h-4 w-4 text-green-500" /> Accepted & Booked</>}
              {drillDown === "lost" && <><XCircle className="h-4 w-4 text-orange-500" /> Accepted but Lost</>}
              {drillDown === "busy" && <><PhoneOff className="h-4 w-4 text-slate-500" /> Busy & Wrong Numbers</>}
              {` (${drillLogs.length})`}
            </h3>
            <button onClick={() => setDrillDown(null)} className="text-xs text-gray-500 hover:text-gray-800">Close ✕</button>
          </div>
          <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
            {drillLogs.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-gray-500">{t("progress.noRecords")}</div>
            ) : drillLogs.map((log: any) => (
              <div key={log.id} className="px-6 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors">
                <div className={`mt-0.5 p-1.5 rounded-full shrink-0 ${
                  log.callStatus === "Accept and book meeting" ? "bg-green-100" :
                  log.callStatus === "Accept but lost" ? "bg-orange-100" :
                  log.callStatus === "Busy" ? "bg-yellow-100" :
                  "bg-gray-100"
                }`}>
                  {log.callStatus === "Accept and book meeting" ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> :
                   log.callStatus === "Accept but lost" ? <XCircle className="h-3.5 w-3.5 text-orange-600" /> :
                   log.callStatus === "Busy" ? <Clock className="h-3.5 w-3.5 text-yellow-600" /> :
                   <PhoneMissed className="h-3.5 w-3.5 text-gray-500" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900">{log.lead?.name}</span>
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                      log.callStatus === "Accept and book meeting" ? "bg-green-100 text-green-700" :
                      log.callStatus === "Accept but lost" ? "bg-orange-100 text-orange-700" :
                      log.callStatus === "Busy" ? "bg-yellow-100 text-yellow-700" :
                      "bg-gray-100 text-gray-600"
                    }`}>{log.callStatus}</span>
                    {log.lead?.classification && (
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                        log.lead.classification === "Hot" ? "bg-red-100 text-red-700" :
                        log.lead.classification === "Warm" ? "bg-amber-100 text-amber-700" :
                        "bg-blue-100 text-blue-700"
                      }`}>{log.lead.classification}</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{log.notes}</p>
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap shrink-0">{new Date(log.createdAt).toLocaleDateString("en-GB")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Meetings Drill-Down (shows full call log history when "meetings" is not selected) */}
      {drillDown === "meetings" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-purple-50">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide flex items-center gap-2">
              <Calendar className="h-4 w-4 text-purple-500" /> Meetings Booked ({data.callLogs.filter(c => c.callStatus === "Accept and book meeting").length})
            </h3>
            <button onClick={() => setDrillDown(null)} className="text-xs text-gray-500 hover:text-gray-800">Close ✕</button>
          </div>
          <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
            {data.callLogs.filter(c => c.callStatus === "Accept and book meeting").length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-gray-500">{t("progress.noMeetings")}</div>
            ) : data.callLogs.filter(c => c.callStatus === "Accept and book meeting").map((log: any) => (
              <div key={log.id} className="px-6 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                    {log.lead?.name?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{log.lead?.name}</p>
                    <p className="text-xs text-gray-400">{log.lead?.phone}</p>
                  </div>
                </div>
                <div className="text-end">
                  {log.lead?.classification && (
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                      log.lead.classification === "Hot" ? "bg-red-100 text-red-700" :
                      log.lead.classification === "Warm" ? "bg-amber-100 text-amber-700" :
                      "bg-blue-100 text-blue-700"
                    }`}>{log.lead.classification}</span>
                  )}
                  <p className="text-xs text-gray-400 mt-1">{new Date(log.createdAt).toLocaleDateString("en-GB")}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Call Logs Detail (only shown if no drill-down is active) */}
      {!drillDown && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">{t("progress.callHistory")}</h3>
            <span className="text-xs text-gray-500">{data.callLogs.length} records</span>
          </div>
          <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
            {data.callLogs.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-gray-500">{t("empty.noCalls")}</div>
            ) : data.callLogs.map((log: any) => (
              <div key={log.id} className="px-6 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors">
                <div className={`mt-0.5 p-1.5 rounded-full shrink-0 ${
                  log.callStatus === "Accept and book meeting" ? "bg-green-100" :
                  log.callStatus === "Accept but lost" ? "bg-orange-100" :
                  log.callStatus === "Busy" ? "bg-yellow-100" :
                  "bg-gray-100"
                }`}>
                  {log.callStatus === "Accept and book meeting" ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> :
                   log.callStatus === "Accept but lost" ? <XCircle className="h-3.5 w-3.5 text-orange-600" /> :
                   log.callStatus === "Busy" ? <Clock className="h-3.5 w-3.5 text-yellow-600" /> :
                   <PhoneMissed className="h-3.5 w-3.5 text-gray-500" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900">{log.lead?.name}</span>
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                      log.callStatus === "Accept and book meeting" ? "bg-green-100 text-green-700" :
                      log.callStatus === "Accept but lost" ? "bg-orange-100 text-orange-700" :
                      log.callStatus === "Busy" ? "bg-yellow-100 text-yellow-700" :
                      "bg-gray-100 text-gray-600"
                    }`}>{log.callStatus}</span>
                    {log.lead?.classification && (
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                        log.lead.classification === "Hot" ? "bg-red-100 text-red-700" :
                        log.lead.classification === "Warm" ? "bg-amber-100 text-amber-700" :
                        "bg-blue-100 text-blue-700"
                      }`}>{log.lead.classification}</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{log.notes}</p>
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap shrink-0">{new Date(log.createdAt).toLocaleDateString("en-GB")}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
