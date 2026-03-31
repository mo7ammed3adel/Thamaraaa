"use client";
import { useState, useEffect, useCallback } from "react";
import { Briefcase, Calendar, Handshake, DollarSign, XCircle, TrendingUp, ChevronDown } from "lucide-react";

interface SalesProgress {
  role: string;
  totalLeads: number;
  meetingsAttended: number;
  dealsWon: number;
  dealsLost: number;
  revenue: number;
  leads: any[];
  meetings: any[];
  deals: any[];
}

type PresetRange = "today" | "yesterday" | "this_week" | "this_month" | "all" | "custom";
type DrillDown = "leads" | "meetings" | "won" | "lost" | "revenue" | null;

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

export default function SalesProgressClient() {
  const [data, setData] = useState<SalesProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState<PresetRange>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [drillDown, setDrillDown] = useState<DrillDown>(null);

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

  const toggleDrill = (d: DrillDown) => setDrillDown(drillDown === d ? null : d);

  const presetBtnClass = (p: PresetRange) =>
    `px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
      preset === p
        ? "bg-green-600 text-white shadow-md"
        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
    }`;

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-green-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!data) return null;

  const winRate = (data.dealsWon + data.dealsLost) > 0
    ? ((data.dealsWon / (data.dealsWon + data.dealsLost)) * 100).toFixed(1)
    : "0.0";

  const wonDeals = data.deals.filter(d => d.status === "Closed_Won" || d.status === "Pending");
  const lostDeals = data.deals.filter(d => d.status === "Closed_Lost");
  const totalMeetings = Math.max(data.meetings.length, data.dealsWon + data.dealsLost);

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
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">To</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Summary Cards - all clickable */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* Total Leads */}
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
          <p className="text-3xl font-bold">{data.totalLeads}</p>
        </div>

        {/* Meetings */}
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
          <p className="text-3xl font-bold">{totalMeetings}</p>
        </div>

        {/* Deals Won */}
        <div
          onClick={() => toggleDrill("won")}
          className={`cursor-pointer rounded-xl p-4 text-white shadow-lg transition-all hover:scale-[1.02] ${drillDown === "won" ? "ring-4 ring-green-300" : ""} bg-gradient-to-br from-green-500 to-emerald-600`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Handshake className="h-5 w-5 opacity-80" />
              <span className="text-xs font-semibold uppercase opacity-80">Deals Won</span>
            </div>
            <ChevronDown className={`h-4 w-4 opacity-60 transition-transform ${drillDown === "won" ? "rotate-180" : ""}`} />
          </div>
          <p className="text-3xl font-bold">{data.dealsWon}</p>
          <p className="text-xs opacity-70 mt-1">{winRate}% win rate</p>
        </div>

        {/* Deals Lost */}
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
          <p className="text-3xl font-bold">{data.dealsLost}</p>
        </div>

        {/* Revenue */}
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
          <p className="text-3xl font-bold">{data.revenue.toLocaleString()}</p>
        </div>
      </div>

      {/* Drill-Down Panels */}

      {/* Leads Panel */}
      {drillDown === "leads" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-in fade-in">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-slate-50">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">All Leads ({data.leads.length})</h3>
            <button onClick={() => setDrillDown(null)} className="text-xs text-gray-500 hover:text-gray-800">Close ✕</button>
          </div>
          <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
            {data.leads.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-gray-500">No leads found for this period.</div>
            ) : data.leads.map((lead: any) => (
              <div key={lead.id} className="px-6 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-slate-500 to-slate-600 flex items-center justify-center text-white text-xs font-bold">
                    {lead.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{lead.name}</p>
                    <p className="text-xs text-gray-400">{lead.phone}</p>
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
                  }`}>{lead.status.replace(/_/g, " ")}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Meetings Panel */}
      {drillDown === "meetings" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-indigo-50">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Meetings ({data.meetings.length})</h3>
            <button onClick={() => setDrillDown(null)} className="text-xs text-gray-500 hover:text-gray-800">Close ✕</button>
          </div>
          <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
            {data.meetings.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-gray-500">No meetings found for this period.</div>
            ) : data.meetings.map((m: any) => (
              <div key={m.id} className="px-6 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                    {m.lead?.name?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{m.lead?.name || "Unknown"}</p>
                    <p className="text-xs text-gray-400">{m.lead?.phone}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                    m.status === "Attended" || m.status === "Won" ? "bg-green-100 text-green-700" :
                    m.status === "Missed" ? "bg-red-100 text-red-700" :
                    "bg-blue-100 text-blue-700"
                  }`}>{m.status}</span>
                  <p className="text-xs text-gray-400 mt-1">{m.meetingDate ? new Date(m.meetingDate).toLocaleDateString("en-GB") : ""} {m.meetingTime || ""}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Won Deals Panel */}
      {drillDown === "won" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-green-50">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" /> Deals Won ({wonDeals.length})
            </h3>
            <button onClick={() => setDrillDown(null)} className="text-xs text-gray-500 hover:text-gray-800">Close ✕</button>
          </div>
          <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
            {wonDeals.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-gray-500">No won deals found for this period.</div>
            ) : wonDeals.map((deal: any) => (
              <div key={deal.id} className="px-6 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div>
                  <p className="text-sm font-medium text-gray-900">{deal.lead?.name}</p>
                  <p className="text-xs text-gray-400">{deal.lead?.phone} • {deal.package}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-green-700">{deal.totalAmount?.toLocaleString()} SAR</p>
                  <p className="text-xs text-gray-400">{new Date(deal.createdAt).toLocaleDateString("en-GB")}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lost Deals Panel */}
      {drillDown === "lost" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-red-50">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" /> Deals Lost ({lostDeals.length})
            </h3>
            <button onClick={() => setDrillDown(null)} className="text-xs text-gray-500 hover:text-gray-800">Close ✕</button>
          </div>
          <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
            {lostDeals.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-gray-500">No lost deals found for this period.</div>
            ) : lostDeals.map((deal: any) => (
              <div key={deal.id} className="px-6 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div>
                  <p className="text-sm font-medium text-gray-900">{deal.lead?.name}</p>
                  <p className="text-xs text-gray-400">{deal.lead?.phone} • {deal.package}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-red-600">{deal.totalAmount?.toLocaleString()} SAR</p>
                  <p className="text-xs text-gray-400">{new Date(deal.createdAt).toLocaleDateString("en-GB")}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Revenue Panel (all won deals with amounts) */}
      {drillDown === "revenue" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-amber-50">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-amber-600" /> Revenue Breakdown ({wonDeals.length} deals)
            </h3>
            <button onClick={() => setDrillDown(null)} className="text-xs text-gray-500 hover:text-gray-800">Close ✕</button>
          </div>
          <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
            {wonDeals.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-gray-500">No revenue data for this period.</div>
            ) : wonDeals.map((deal: any) => (
              <div key={deal.id} className="px-6 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div>
                  <p className="text-sm font-medium text-gray-900">{deal.lead?.name}</p>
                  <p className="text-xs text-gray-400">{deal.package} • {new Date(deal.createdAt).toLocaleDateString("en-GB")}</p>
                </div>
                <p className="text-sm font-bold text-amber-700">{deal.totalAmount?.toLocaleString()} SAR</p>
              </div>
            ))}
            <div className="px-6 py-3 bg-amber-50 flex justify-between items-center">
              <p className="text-sm font-bold text-gray-900">Total Revenue</p>
              <p className="text-lg font-bold text-amber-700">{data.revenue.toLocaleString()} SAR</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
