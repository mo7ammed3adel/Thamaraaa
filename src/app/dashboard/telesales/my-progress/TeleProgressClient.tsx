"use client";
import { useState, useEffect, useCallback } from "react";
import { PhoneCall, Calendar, PhoneOff, PhoneMissed, CheckCircle2, XCircle, Clock } from "lucide-react";

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

type PresetRange = "today" | "yesterday" | "this_week" | "this_month" | "all" | "custom";

function getPresetDates(preset: PresetRange): { from: string; to: string } {
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().split("T")[0];

  switch (preset) {
    case "today":
      return { from: fmt(now), to: fmt(now) };
    case "yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { from: fmt(y), to: fmt(y) };
    }
    case "this_week": {
      const start = new Date(now);
      start.setDate(start.getDate() - start.getDay());
      return { from: fmt(start), to: fmt(now) };
    }
    case "this_month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: fmt(start), to: fmt(now) };
    }
    default:
      return { from: "", to: "" };
  }
}

export default function TeleProgressClient() {
  const [data, setData] = useState<TeleProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState<PresetRange>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);
      const res = await fetch(`/api/analytics/my-progress?${params.toString()}`);
      if (res.ok) {
        setData(await res.json());
      }
    } catch {
      console.error("Failed to fetch progress");
    }
    setLoading(false);
  }, [fromDate, toDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePreset = (p: PresetRange) => {
    setPreset(p);
    if (p === "custom") return;
    const { from, to } = getPresetDates(p);
    setFromDate(from);
    setToDate(to);
  };

  const presetBtnClass = (p: PresetRange) =>
    `px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
      preset === p
        ? "bg-blue-600 text-white shadow-md"
        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
    }`;

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

  return (
    <div className="space-y-6">
      {/* Time Filter */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <div className="flex flex-wrap gap-2 items-center mb-3">
          <span className="text-xs font-semibold text-gray-500 uppercase mr-2">Time Range:</span>
          <button onClick={() => handlePreset("all")} className={presetBtnClass("all")}>All Time</button>
          <button onClick={() => handlePreset("today")} className={presetBtnClass("today")}>Today</button>
          <button onClick={() => handlePreset("yesterday")} className={presetBtnClass("yesterday")}>Yesterday</button>
          <button onClick={() => handlePreset("this_week")} className={presetBtnClass("this_week")}>This Week</button>
          <button onClick={() => handlePreset("this_month")} className={presetBtnClass("this_month")}>This Month</button>
          <button onClick={() => handlePreset("custom")} className={presetBtnClass("custom")}>Custom</button>
        </div>
        {preset === "custom" && (
          <div className="flex flex-wrap gap-4 items-end pt-2 border-t border-gray-100">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">From</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">To</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <PhoneCall className="h-5 w-5 opacity-80" />
            <span className="text-xs font-semibold uppercase opacity-80">Total Calls</span>
          </div>
          <p className="text-3xl font-bold">{data.totalCalls}</p>
          <p className="text-xs opacity-70 mt-1">{data.totalLeads} leads assigned</p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-4 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-5 w-5 opacity-80" />
            <span className="text-xs font-semibold uppercase opacity-80">Accept & Book</span>
          </div>
          <p className="text-3xl font-bold">{data.acceptAndBook}</p>
          <p className="text-xs opacity-70 mt-1">{conversionRate}% conversion rate</p>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-4 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="h-5 w-5 opacity-80" />
            <span className="text-xs font-semibold uppercase opacity-80">Accept but Lost</span>
          </div>
          <p className="text-3xl font-bold">{data.acceptButLost}</p>
        </div>

        <div className="bg-gradient-to-br from-slate-500 to-slate-600 rounded-xl p-4 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <PhoneOff className="h-5 w-5 opacity-80" />
            <span className="text-xs font-semibold uppercase opacity-80">Busy</span>
          </div>
          <p className="text-3xl font-bold">{data.busy}</p>
          <p className="text-xs opacity-70 mt-1">{data.wrongNumber} wrong numbers</p>
        </div>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-purple-100 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-50 rounded-lg">
              <Calendar className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-purple-600">{data.meetingsBooked}</p>
              <p className="text-xs text-gray-500">Meetings Booked</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-yellow-100 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-50 rounded-lg">
              <PhoneMissed className="h-5 w-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-600">{data.wrongNumber}</p>
              <p className="text-xs text-gray-500">Wrong Numbers</p>
            </div>
          </div>
        </div>
      </div>

      {/* Call Logs Detail */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Call Log History</h3>
          <span className="text-xs text-gray-500">{data.callLogs.length} records</span>
        </div>
        <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
          {data.callLogs.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-gray-500">No call logs found for this period.</div>
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
    </div>
  );
}
