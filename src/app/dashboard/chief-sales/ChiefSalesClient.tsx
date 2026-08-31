"use client";

import { useState, useEffect } from "react";
import DrillDownModal from "@/components/DrillDownModal";
import { DollarSign, CheckCircle2, TrendingUp, Users, Presentation, CalendarX } from "lucide-react";
import { getChiefSalesAnalytics } from "@/client/api/analytics";
import { useTranslator } from "@/components/i18n/LocaleProvider";

export default function ChiefSalesClient() {
  const t = useTranslator();
  const [range, setRange] = useState("today");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Drill down state
  const [drillDown, setDrillDown] = useState<{ isOpen: boolean; title: string; data: any[]; columns: any[] }>({
    isOpen: false, title: "", data: [], columns: []
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await getChiefSalesAnalytics({ range });
      setData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [range]);

  if (loading && !data) return <div className="flex justify-center p-12"><div className="animate-spin h-8 w-8 border-b-2 border-indigo-600 rounded-full"></div></div>;
  if (!data) return <div className="text-center text-red-500">{t("chief.loadFailed")}</div>;

  const { overview, teleSalesTeam, salesTeam, recentDeals, warnings } = data;

  const openDrillDown = (title: string, dataKey: string, cols: any[]) => {
    let targetData = [];
    if (dataKey === "recentDeals") targetData = recentDeals;
    else if (dataKey === "teleSalesTeam") targetData = teleSalesTeam;
    else if (dataKey === "salesTeam") targetData = salesTeam;

    setDrillDown({
      isOpen: true,
      title,
      data: targetData,
      columns: cols
    });
  };

  const dealColumns = [
    { key: "client", label: "Client Name", render: (v: any, row: any) => row.lead?.name || "N/A" },
    { key: "agent", label: "Sales Agent", render: (v: any, row: any) => row.salesAgent?.name || "N/A" },
    { key: "package", label: "Package", render: (v: any, row: any) => row.package },
    { key: "totalAmount", label: "Amount (SAR)", render: (v: any, row: any) => row.totalAmount.toLocaleString() },
    { key: "status", label: "Status", render: (v: any, row: any) => row.status },
  ];

  const salesTeamCols = [
    { key: "name", label: "Agent Name" },
    { key: "dealsClosed", label: "Total Deals", render: (v: any) => <span className="font-bold text-emerald-600">{v}</span> },
    { key: "revenueGenerated", label: "Revenue (SAR)", render: (v: any) => v.toLocaleString() },
    { key: "avgDealSize", label: "Avg Deal Vol", render: (v: any) => v.toLocaleString() },
  ];

  const teleTeamCols = [
    { key: "name", label: "Agent Name" },
    { key: "meetingsBooked", label: "Booked" },
    { key: "attended", label: "Attended", render: (v: any) => <span className="text-emerald-600 font-bold">{v}</span> },
    { key: "lost", label: "Lost", render: (v: any) => <span className="text-red-500">{v}</span> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-100">
        <h2 className="text-xl font-bold text-slate-800">{t("chief.overview")}</h2>
        <select 
          value={range} 
          onChange={(e) => setRange(e.target.value)}
          className="border-slate-200 border text-sm font-semibold text-slate-700 bg-slate-50 py-2 px-4 rounded-lg focus:outline-none focus:ring-2 ring-indigo-500"
        >
          <option value="today">Today</option>
          <option value="this_week">This Week</option>
          <option value="this_month">{t("dateRange.thisMonth")}</option>
          <option value="all">{t("chief.allTime")}</option>
        </select>
      </div>

      {loading && <div className="absolute top-20 right-10 bg-indigo-50 text-indigo-600 px-3 py-1 rounded text-xs animate-pulse font-bold">{t("chief.refreshing")}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI Cards */}
        <div 
          onClick={() => openDrillDown("Won Deals Breakdown", "recentDeals", dealColumns)}
          className="bg-white border hover:border-emerald-300 hover:shadow-md cursor-pointer transition p-5 rounded-xl shadow-sm border-slate-200 space-y-2 relative overflow-hidden group"
        >
          <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition text-emerald-500"><DollarSign size={80} /></div>
          <p className="text-sm font-medium text-slate-500">{t("finance.totalRevenue")}</p>
          <h3 className="text-3xl font-bold text-slate-800">{overview.totalRevenue.toLocaleString()}<span className="text-lg text-slate-400 font-normal ms-1">{t("finance.sar")}</span></h3>
          <p className="text-xs text-slate-400">Target: {overview.totalNetTarget.toLocaleString()} SAR</p>
        </div>

        <div 
          onClick={() => openDrillDown("Collected Payments Breakdown", "recentDeals", dealColumns)}
          className="bg-white border hover:border-indigo-300 hover:shadow-md cursor-pointer transition p-5 rounded-xl shadow-sm border-slate-200 space-y-2 relative overflow-hidden group"
        >
          <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition text-indigo-500"><CheckCircle2 size={80} /></div>
          <p className="text-sm font-medium text-slate-500">{t("chief.collectedPayments")}</p>
          <h3 className="text-3xl font-bold text-indigo-600">{overview.totalCollected.toLocaleString()}<span className="text-lg text-slate-400 font-normal ms-1">{t("finance.sar")}</span></h3>
          <p className="text-xs text-slate-400">{t("chief.actualMoney")}</p>
        </div>

        <div 
          onClick={() => openDrillDown("Deals Data", "recentDeals", dealColumns)}
          className="bg-white border hover:border-purple-300 hover:shadow-md cursor-pointer transition p-5 rounded-xl shadow-sm border-slate-200 space-y-2 relative overflow-hidden group"
        >
          <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition text-purple-500"><TrendingUp size={80} /></div>
          <p className="text-sm font-medium text-slate-500">{t("chief.conversionVolume")}</p>
          <div className="flex gap-4 items-end">
            <h3 className="text-3xl font-bold text-slate-800">{overview.totalDeals} <span className="text-sm font-normal text-slate-400">{t("team.deals")}</span></h3>
            <span className="text-sm font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded">{overview.totalLeads > 0 ? Math.round((overview.totalDeals / overview.totalLeads)*100) : 0}% Conv</span>
          </div>
          <p className="text-xs text-slate-400">Total Leads: {overview.totalLeads}</p>
        </div>

        <div 
          onClick={() => openDrillDown("TeleSales Meetings", "teleSalesTeam", teleTeamCols)}
          className="bg-white border hover:border-blue-300 hover:shadow-md cursor-pointer transition p-5 rounded-xl shadow-sm border-slate-200 space-y-2 relative overflow-hidden group"
        >
          <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition text-blue-500"><Presentation size={80} /></div>
          <p className="text-sm font-medium text-slate-500">{t("metric.meetingsBooked")}</p>
          <div className="flex gap-4 items-end">
            <h3 className="text-3xl font-bold text-slate-800">{overview.meetingsBooked}</h3>
            <span className="text-sm font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{overview.meetingsBooked > 0 ? Math.round((overview.meetingsAttended / overview.meetingsBooked)*100) : 0}% Attend</span>
          </div>
          <p className="text-xs text-slate-400 flex gap-2">
            <span className="text-emerald-600">Attended: {overview.meetingsAttended}</span>
            <span className="text-red-500">Lost: {overview.meetingsLost}</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Team Rankings */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <h3 className="font-bold text-slate-800 flex items-center gap-2"><Users size={18} className="text-purple-600"/> Sales Performance Leaderboard</h3>
            <button onClick={() => openDrillDown("Sales Team Detailed", "salesTeam", salesTeamCols)} className="text-xs text-indigo-600 hover:underline font-semibold">{t("common.viewAll")}</button>
          </div>
          <table className="w-full text-sm text-start">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-semibold">{t("common.agent")}</th>
                <th className="px-4 py-2 font-semibold text-center">{t("team.deals")}</th>
                <th className="px-4 py-2 font-semibold text-end">{t("finance.revenue")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {salesTeam.slice(0,5).map((agent: any, i: number) => (
                <tr key={i} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-semibold text-slate-700">{agent.name}</td>
                  <td className="px-4 py-3 text-center font-bold text-emerald-600">{agent.dealsClosed}</td>
                  <td className="px-4 py-3 text-end font-medium">{agent.revenueGenerated.toLocaleString()} SAR</td>
                </tr>
              ))}
              {salesTeam.length === 0 && <tr><td colSpan={3} className="text-center py-4 text-slate-400 italic">{t("chief.noDeals")}</td></tr>}
            </tbody>
          </table>
        </div>

        {/* TeleSales Team Rankings */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <h3 className="font-bold text-slate-800 flex items-center gap-2"><CalendarX size={18} className="text-blue-600"/> TeleSales Leaderboard</h3>
            <button onClick={() => openDrillDown("TeleSales Detailed", "teleSalesTeam", teleTeamCols)} className="text-xs text-indigo-600 hover:underline font-semibold">{t("common.viewAll")}</button>
          </div>
          <table className="w-full text-sm text-start">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-semibold">{t("common.agent")}</th>
                <th className="px-4 py-2 font-semibold text-center">{t("chief.booked")}</th>
                <th className="px-4 py-2 font-semibold text-center">{t("status.attended")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {teleSalesTeam.slice(0,5).map((agent: any, i: number) => (
                <tr key={i} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-semibold text-slate-700">{agent.name}</td>
                  <td className="px-4 py-3 text-center font-bold text-slate-700">{agent.meetingsBooked}</td>
                  <td className="px-4 py-3 text-center font-bold text-emerald-600">{agent.attended}</td>
                </tr>
              ))}
              {teleSalesTeam.length === 0 && <tr><td colSpan={3} className="text-center py-4 text-slate-400 italic">{t("chief.noMeetings")}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Warnings Section */}
      {warnings && warnings.length > 0 && (
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-5 mt-6 shadow-sm">
          <h3 className="font-bold text-red-800 text-lg mb-4 flex items-center gap-2">🚨 System Warnings & Alerts</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {warnings.map((w: any) => (
              <div key={w.id} className="bg-white rounded-lg p-3 border border-red-100 shadow-sm flex items-start gap-3">
                <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${w.severity === 'Critical' ? 'bg-red-800' : w.severity === 'High' ? 'bg-red-500' : 'bg-amber-400'}`} />
                <div>
                  <h4 className="font-bold text-slate-800 text-sm leading-none mb-1">{w.subject || "Warning"}</h4>
                  <p className="text-xs text-slate-600 line-clamp-2">{w.message}</p>
                  <div className="flex justify-between items-center mt-2 text-[10px] text-slate-400">
                    <span className="font-medium bg-slate-100 px-1.5 py-0.5 rounded capitalize">{w.senderRole.replace(/_/g, ' ')}</span>
                    <span>{new Date(w.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <DrillDownModal 
        isOpen={drillDown.isOpen}
        onClose={() => setDrillDown({ ...drillDown, isOpen: false })}
        title={drillDown.title}
        data={drillDown.data}
        columns={drillDown.columns}
      />
    </div>
  );
}
