"use client";
import { useState, useEffect, useCallback } from "react";
import { Briefcase, Calendar, Handshake, DollarSign, XCircle, TrendingUp } from "lucide-react";

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

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-slate-600 to-slate-700 rounded-xl p-4 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <Briefcase className="h-5 w-5 opacity-80" />
            <span className="text-xs font-semibold uppercase opacity-80">Total Leads</span>
          </div>
          <p className="text-3xl font-bold">{data.totalLeads}</p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-4 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <Handshake className="h-5 w-5 opacity-80" />
            <span className="text-xs font-semibold uppercase opacity-80">Deals Won</span>
          </div>
          <p className="text-3xl font-bold">{data.dealsWon}</p>
          <p className="text-xs opacity-70 mt-1">{winRate}% win rate</p>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-4 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="h-5 w-5 opacity-80" />
            <span className="text-xs font-semibold uppercase opacity-80">Deals Lost</span>
          </div>
          <p className="text-3xl font-bold">{data.dealsLost}</p>
        </div>

        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-4 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-5 w-5 opacity-80" />
            <span className="text-xs font-semibold uppercase opacity-80">Revenue</span>
          </div>
          <p className="text-3xl font-bold">{data.revenue.toLocaleString()}</p>
        </div>
      </div>

      {/* Recent Leads */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Leads Received</h3>
          <span className="text-xs text-gray-500">{data.leads.length} total</span>
        </div>
        <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
          {data.leads.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-gray-500">No leads found for this period.</div>
          ) : data.leads.map((lead: any) => (
            <div key={lead.id} className="px-6 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white text-xs font-bold">
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

      {/* Recent Deals */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-500" /> Deals
          </h3>
          <span className="text-xs text-gray-500">{data.deals.length} total</span>
        </div>
        <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
          {data.deals.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-gray-500">No deals found for this period.</div>
          ) : data.deals.map((deal: any) => (
            <div key={deal.id} className="px-6 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors">
              <div>
                <p className="text-sm font-medium text-gray-900">{deal.lead?.name}</p>
                <p className="text-xs text-gray-400">{deal.lead?.phone} • {deal.package}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-green-700">{deal.totalAmount.toLocaleString()} SAR</p>
                <p className="text-xs text-gray-400">{new Date(deal.createdAt).toLocaleDateString("en-GB")}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
