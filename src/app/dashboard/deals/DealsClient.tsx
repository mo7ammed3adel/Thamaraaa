"use client";
import { useState, useEffect } from "react";
import { DollarSign, X, PhoneCall, Calendar, Handshake, ArrowRight, Clock } from "lucide-react";

interface Deal {
  id: string;
  totalAmount: number;
  firstAmount: number | null;
  package: string;
  paymentMethod: string;
  status: string;
  createdAt: string;
  contractStart: string | null;
  contractEnd: string | null;
  lead: {
    id: string;
    name: string;
    phone: string;
    classification: string;
    source: string | null;
    status: string;
    createdAt: string;
    teleAgent: { name: string; id: string } | null;
    callLogs: { id: string; callStatus: string; notes: string; createdAt: string; classification: string | null; agent: { name: string } }[];
    meetings: { id: string; meetingDate: string; meetingTime: string | null; status: string; salesNotes: string | null; summary: string | null; teleAgent: { name: string }; salesAgent: { name: string } | null }[];
  };
  salesAgent: { name: string; id: string };
  installments: { id: string; amount: number; dueDate: string; isPaid: boolean }[];
}

export default function DealsClient({ userRole }: { userRole: string }) {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [filterType, setFilterType] = useState<"All" | "Late" | "Pending">("All");

  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>({ key: "date", direction: "desc" });

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const setQuickDate = (type: string) => {
    const today = new Date();
    const toIso = (d: Date) => {
      const offset = d.getTimezoneOffset() * 60000;
      return new Date(d.getTime() - offset).toISOString().split('T')[0];
    };
    if (type === "today") {
      setFromDate(toIso(today));
      setToDate(toIso(today));
    } else if (type === "yesterday") {
      const y = new Date(today); y.setDate(y.getDate() - 1);
      setFromDate(toIso(y));
      setToDate(toIso(y));
    } else if (type === "week") {
      const w = new Date(today); w.setDate(w.getDate() - w.getDay());
      setFromDate(toIso(w));
      setToDate(toIso(today));
    } else if (type === "month") {
      const m = new Date(today.getFullYear(), today.getMonth(), 1);
      setFromDate(toIso(m));
      setToDate(toIso(today));
    } else if (type === "lastMonth") {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      setFromDate(toIso(start));
      setToDate(toIso(end));
    }
  };

  useEffect(() => {
    fetchDeals();
  }, []);

  const fetchDeals = async () => {
    try {
      const res = await fetch("/api/deals/list");
      if (res.ok) {
        setDeals(await res.json());
      }
    } catch {
      console.error("Failed to fetch deals");
    }
    setLoading(false);
  };

  const calculatePaidAmount = (d: any) => {
    if (!d.installments || d.installments.length === 0) {
      return d.firstAmount !== null ? d.firstAmount : d.totalAmount;
    }
    const upfront = d.firstAmount || 0;
    const installmentsPaid = d.installments.filter((i: any) => i.isPaid).reduce((s: number, i: any) => s + i.amount, 0);
    return upfront + installmentsPaid;
  };

  const timeFilteredDeals = deals.filter(d => {
    if (fromDate || toDate) {
      const targetDate = new Date(d.createdAt);
      if (fromDate) {
        const start = new Date(fromDate); start.setHours(0,0,0,0);
        if (targetDate < start) return false;
      }
      if (toDate) {
        const end = new Date(toDate); end.setHours(23,59,59,999);
        if (targetDate > end) return false;
      }
    }
    return true;
  });

  const totalContractValue = timeFilteredDeals.reduce((sum, d) => sum + d.totalAmount, 0);
  const totalRevenue = timeFilteredDeals.reduce((sum, d) => sum + (d.firstAmount || d.totalAmount), 0);
  const totalPaidAmount = timeFilteredDeals.reduce((sum, d) => sum + calculatePaidAmount(d), 0);
  const pendingPaymentsAmount = timeFilteredDeals.reduce((sum, d) => sum + Math.max(0, d.totalAmount - calculatePaidAmount(d)), 0);
  const collectionRate = totalRevenue > 0 ? Math.round((totalPaidAmount / totalRevenue) * 100) : 0;
  
  const pendingPaymentsDealsCount = timeFilteredDeals.filter(d => (d.totalAmount - calculatePaidAmount(d)) > 0).length;

  const lateDeals = timeFilteredDeals.filter(d => d.installments.some((i: any) => !i.isPaid && new Date(i.dueDate) < new Date()));
  const pendingDeals = timeFilteredDeals.filter(d => (d.totalAmount - calculatePaidAmount(d)) > 0);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const displayDeals = (filterType === "Late" ? lateDeals : filterType === "Pending" ? pendingDeals : timeFilteredDeals).sort((a, b) => {
    if (!sortConfig) return 0;
    
    let aVal: any = 0;
    let bVal: any = 0;
    
    if (sortConfig.key === "client") {
      aVal = a.lead.name.toLowerCase();
      bVal = b.lead.name.toLowerCase();
    } else if (sortConfig.key === "phone") {
      aVal = a.lead.phone;
      bVal = b.lead.phone;
    } else if (sortConfig.key === "agent") {
      aVal = a.salesAgent.name.toLowerCase();
      bVal = b.salesAgent.name.toLowerCase();
    } else if (sortConfig.key === "package") {
      aVal = a.package.toLowerCase();
      bVal = b.package.toLowerCase();
    } else if (sortConfig.key === "paid") {
      aVal = calculatePaidAmount(a);
      bVal = calculatePaidAmount(b);
    } else if (sortConfig.key === "remaining") {
      aVal = a.totalAmount - calculatePaidAmount(a);
      bVal = b.totalAmount - calculatePaidAmount(b);
    } else if (sortConfig.key === "status") {
      const aRem = a.totalAmount - calculatePaidAmount(a);
      const bRem = b.totalAmount - calculatePaidAmount(b);
      aVal = aRem === 0 ? "completed" : "partial";
      bVal = bRem === 0 ? "completed" : "partial";
    } else if (sortConfig.key === "date") {
      aVal = new Date(a.createdAt).getTime();
      bVal = new Date(b.createdAt).getTime();
    }

    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (sortConfig?.key !== columnKey) return <span className="opacity-0 group-hover:opacity-30 inline-block ml-1 text-xs">↕</span>;
    return <span className="ml-1 text-blue-600 text-xs">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div className="space-y-6">
      
      {/* Date Filters Header */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
           <h3 className="text-gray-800 font-bold flex items-center gap-2">
             <Calendar className="h-5 w-5 text-gray-400" />
             Financial Period Filters
           </h3>
           <p className="text-xs text-gray-500 mt-1">Filtering by deal closing date. All financial KPIs below update actively.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-2">
           <div className="flex items-center gap-2">
             <div className="flex items-center border border-gray-300 rounded-lg px-2 bg-gray-50 focus-within:ring-2 focus-within:ring-green-500">
               <span className="text-xs font-bold text-gray-500">From</span>
               <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="text-sm bg-transparent border-none focus:ring-0 py-2 cursor-pointer" />
             </div>
             <div className="flex items-center border border-gray-300 rounded-lg px-2 bg-gray-50 focus-within:ring-2 focus-within:ring-green-500">
               <span className="text-xs font-bold text-gray-500">To</span>
               <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="text-sm bg-transparent border-none focus:ring-0 py-2 cursor-pointer" />
             </div>
           </div>
           
           <div className="flex items-center gap-1.5 flex-wrap">
             <button onClick={() => setQuickDate('today')} className="text-[10px] font-bold uppercase bg-green-50 text-green-700 px-2.5 py-1.5 rounded-md hover:bg-green-100 transition border border-green-200">Today</button>
             <button onClick={() => setQuickDate('week')} className="text-[10px] font-bold uppercase bg-blue-50 text-blue-700 px-2.5 py-1.5 rounded-md hover:bg-blue-100 transition border border-blue-200">This Week</button>
             <button onClick={() => setQuickDate('month')} className="text-[10px] font-bold uppercase bg-blue-50 text-blue-700 px-2.5 py-1.5 rounded-md hover:bg-blue-100 transition border border-blue-200">This Month</button>
             <button onClick={() => setQuickDate('lastMonth')} className="text-[10px] font-bold uppercase bg-slate-100 text-slate-700 px-2.5 py-1.5 rounded-md hover:bg-slate-200 transition border border-slate-200">Last Month</button>
             
             {(fromDate || toDate) && (
               <button onClick={() => { setFromDate(""); setToDate(""); }} className="text-[10px] font-bold uppercase text-red-600 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-md transition shadow-sm border border-red-200 ml-1">Reset</button>
             )}
           </div>
        </div>
      </div>

      {/* Summary Area */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <div 
          onClick={() => setFilterType("All")}
          className={`cursor-pointer rounded-xl p-4 text-white shadow-lg transition-transform hover:scale-105 ${filterType === "All" ? "ring-4 ring-emerald-300" : ""} bg-gradient-to-br from-green-500 to-emerald-600`}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <Handshake className="h-4 w-4 opacity-80" />
            <span className="text-[10px] font-semibold uppercase opacity-80">Total Deals</span>
          </div>
          <p className="text-2xl font-bold">{timeFilteredDeals.length}</p>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl p-4 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-1.5">
            <DollarSign className="h-4 w-4 opacity-80" />
            <span className="text-[10px] font-semibold uppercase opacity-80">Total Revenue Contracted</span>
          </div>
          <p className="text-2xl font-bold">{totalRevenue.toLocaleString()}</p>
          <p className="text-[9px] opacity-70 mt-1">SAR CONTRACT VALUE</p>
        </div>

        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-4 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-1.5">
            <DollarSign className="h-4 w-4 opacity-80" />
            <span className="text-[10px] font-semibold uppercase opacity-80">Total Paid Amount</span>
          </div>
          <p className="text-2xl font-bold">{totalPaidAmount.toLocaleString()}</p>
          <p className="text-[9px] opacity-70 mt-1">SAR SUCCESSFULLY COLLECTED</p>
        </div>

        <div 
          onClick={() => setFilterType(filterType === "Pending" ? "All" : "Pending")}
          className={`cursor-pointer rounded-xl p-4 text-white shadow-lg transition-transform hover:scale-105 ${filterType === "Pending" ? "bg-amber-600 ring-4 ring-amber-300" : "bg-gradient-to-br from-amber-400 to-orange-500"}`}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <DollarSign className="h-4 w-4 opacity-80" />
            <span className="text-[10px] font-semibold uppercase opacity-80">Pending Payments / Installments</span>
          </div>
          <p className="text-2xl font-bold">{pendingPaymentsAmount.toLocaleString()}</p>
          <p className="text-[9px] opacity-80 mt-1 font-bold">SAR REMAINING OVER {pendingPaymentsDealsCount} CLIENTS</p>
        </div>

        <div className="bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl p-4 text-white shadow-lg flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-1.5">
            <Handshake className="h-4 w-4 opacity-80" />
            <span className="text-[10px] font-semibold uppercase opacity-80">Collection Rate</span>
          </div>
          <div className="flex items-end gap-2">
            <p className="text-3xl font-bold">{collectionRate}%</p>
          </div>
          <div className="w-full bg-white/20 h-1.5 mt-2 rounded-full overflow-hidden">
            <div className="bg-white h-full" style={{ width: `${collectionRate}%` }}></div>
          </div>
        </div>

        <div 
          onClick={() => setFilterType(filterType === "Late" ? "All" : "Late")}
          className={`cursor-pointer rounded-xl p-4 text-white shadow-lg transition-transform hover:scale-105 ${filterType === "Late" ? "bg-red-600 ring-4 ring-red-300" : "bg-gradient-to-br from-red-500 to-rose-600"}`}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <Clock className="h-4 w-4 opacity-80" />
            <span className="text-[10px] font-semibold uppercase opacity-80">Late Payments</span>
          </div>
          <p className="text-2xl font-bold">{lateDeals.length}</p>
          <p className="text-[9px] opacity-70 mt-1">PENDING INSTALLMENTS PAST DUE</p>
        </div>
      </div>

      {/* Deals Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-white">
              <tr>
                <th onClick={() => handleSort('client')} className="group px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase cursor-pointer hover:bg-gray-100 select-none">Client <SortIcon columnKey="client"/></th>
                <th onClick={() => handleSort('phone')} className="group px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase cursor-pointer hover:bg-gray-100 select-none">Phone <SortIcon columnKey="phone"/></th>
                <th onClick={() => handleSort('agent')} className="group px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase cursor-pointer hover:bg-gray-100 select-none">Sales Agent <SortIcon columnKey="agent"/></th>
                <th onClick={() => handleSort('package')} className="group px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase cursor-pointer hover:bg-gray-100 select-none">Package <SortIcon columnKey="package"/></th>
                <th onClick={() => handleSort('paid')} className="group px-6 py-3 text-right text-xs font-bold text-gray-600 uppercase cursor-pointer hover:bg-gray-100 select-none">Paid / Total <SortIcon columnKey="paid"/></th>
                <th onClick={() => handleSort('remaining')} className="group px-6 py-3 text-right text-xs font-bold text-gray-600 uppercase cursor-pointer hover:bg-gray-100 select-none">Remaining <SortIcon columnKey="remaining"/></th>
                <th onClick={() => handleSort('status')} className="group px-6 py-3 text-center text-xs font-bold text-gray-600 uppercase cursor-pointer hover:bg-gray-100 select-none">Payment Status <SortIcon columnKey="status"/></th>
                <th onClick={() => handleSort('date')} className="group px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase cursor-pointer hover:bg-gray-100 select-none">Date <SortIcon columnKey="date"/></th>
                <th className="px-6 py-3 text-center text-xs font-bold text-gray-600 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-500">Loading deals...</td></tr>
              ) : displayDeals.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-500">No deals found.</td></tr>
              ) : displayDeals.map((deal) => (
                <tr key={deal.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => setSelectedDeal(deal)}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">{deal.lead.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-mono">{deal.lead.phone}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{deal.salesAgent.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">{deal.package}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                    <span className="font-bold text-green-700">{calculatePaidAmount(deal).toLocaleString()}</span>
                    <span className="text-gray-400 text-xs ml-1">/ {deal.totalAmount.toLocaleString()}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-red-600">
                    {Math.max(0, deal.totalAmount - calculatePaidAmount(deal)).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                    {Math.max(0, deal.totalAmount - calculatePaidAmount(deal)) === 0 ? (
                      <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-sm">Completed</span>
                    ) : (
                      <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200 shadow-sm">Partial</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(deal.createdAt).toLocaleDateString("en-GB")}</td>
                  <td className="px-6 py-4 text-center">
                    <button className="text-blue-600 hover:text-blue-800 text-xs font-medium hover:underline">View Journey</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Client Journey Popup */}
      {selectedDeal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setSelectedDeal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-green-50 to-emerald-50">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{selectedDeal.lead.name} — Client Journey</h3>
                <p className="text-sm text-gray-500">{selectedDeal.lead.phone} • {selectedDeal.lead.classification} Lead • Source: {selectedDeal.lead.source || "Unknown"}</p>
              </div>
              <button onClick={() => setSelectedDeal(null)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded-lg transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Deal Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-green-700">{(selectedDeal.firstAmount || selectedDeal.totalAmount).toLocaleString()}</p>
                  <p className="text-xs text-green-600">{selectedDeal.firstAmount ? "First Amount (SAR)" : "Deal Amount (SAR)"}</p>
                  {selectedDeal.firstAmount && <p className="text-[10px] text-gray-500 mt-1">Total: {selectedDeal.totalAmount.toLocaleString()}</p>}
                </div>
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-indigo-700">{selectedDeal.package}</p>
                  <p className="text-xs text-indigo-600">Package</p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-blue-700">{selectedDeal.paymentMethod}</p>
                  <p className="text-xs text-blue-600">Payment Method</p>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-purple-700">{selectedDeal.salesAgent.name}</p>
                  <p className="text-xs text-purple-600">Sales Agent</p>
                </div>
              </div>

              {/* Timeline */}
              <div>
                <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-4">Full Process Timeline</h4>
                <div className="relative border-l-2 border-gray-200 pl-6 space-y-4">
                  {/* Lead Entry */}
                  <div className="relative">
                    <div className="absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-blue-500 border-2 border-white" />
                    <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-blue-700 uppercase">Lead Created</span>
                        <span className="text-xs text-gray-400">{new Date(selectedDeal.lead.createdAt).toLocaleDateString("en-GB")}</span>
                      </div>
                      <p className="text-sm text-gray-600">
                        {selectedDeal.lead.name} entered the system as a {selectedDeal.lead.classification} lead
                        {selectedDeal.lead.teleAgent ? ` assigned to ${selectedDeal.lead.teleAgent.name}` : ""}.
                      </p>
                    </div>
                  </div>

                  {/* Call Logs */}
                  {selectedDeal.lead.callLogs.map((log) => (
                    <div key={log.id} className="relative">
                      <div className={`absolute -left-[31px] top-1 w-4 h-4 rounded-full border-2 border-white ${
                        log.callStatus === "Accept and book meeting" ? "bg-green-500" :
                        log.callStatus === "Accept but lost" ? "bg-orange-400" :
                        log.callStatus === "Busy" ? "bg-yellow-400" :
                        log.callStatus === "Wrong Number" ? "bg-red-400" :
                        "bg-gray-400"
                      }`} />
                      <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                        <div className="flex items-center gap-2 mb-1">
                          <PhoneCall className="h-3 w-3 text-gray-500" />
                          <span className="text-xs font-bold text-gray-700 uppercase">Call — {log.callStatus}</span>
                          <span className="text-xs text-gray-400">{new Date(log.createdAt).toLocaleDateString("en-GB")}</span>
                          <span className="text-xs text-gray-400">by {log.agent.name}</span>
                        </div>
                        {log.classification && (
                          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium mb-1 ${
                            log.classification === "Hot" ? "bg-red-100 text-red-700" :
                            log.classification === "Warm" ? "bg-amber-100 text-amber-700" :
                            "bg-blue-100 text-blue-700"
                          }`}>{log.classification}</span>
                        )}
                        <p className="text-sm text-gray-600">{log.notes}</p>
                      </div>
                    </div>
                  ))}

                  {/* Meetings */}
                  {selectedDeal.lead.meetings.map((m) => (
                    <div key={m.id} className="relative">
                      <div className={`absolute -left-[31px] top-1 w-4 h-4 rounded-full border-2 border-white ${
                        m.status === "Won" ? "bg-green-500" :
                        m.status === "Attended" ? "bg-indigo-500" :
                        m.status === "Lost" ? "bg-red-500" : "bg-purple-400"
                      }`} />
                      <div className="bg-purple-50 rounded-lg p-3 border border-purple-100">
                        <div className="flex items-center gap-2 mb-1">
                          <Calendar className="h-3 w-3 text-purple-500" />
                          <span className="text-xs font-bold text-purple-700 uppercase">Meeting — {m.status}</span>
                          <span className="text-xs text-gray-400">{new Date(m.meetingDate).toLocaleDateString("en-GB")} {m.meetingTime || ""}</span>
                        </div>
                        {m.salesAgent && (
                          <p className="text-xs text-purple-600">Sales Agent: {m.salesAgent.name}</p>
                        )}
                        {m.salesNotes && (
                          <p className="text-sm text-gray-600 mt-1 italic">Sales Notes: "{m.salesNotes}"</p>
                        )}
                        {m.summary && (
                          <p className="text-sm text-gray-600 mt-1">Summary: {m.summary}</p>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Deal Closed */}
                  <div className="relative">
                    <div className="absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-green-600 border-2 border-white ring-4 ring-green-100" />
                    <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                      <div className="flex items-center gap-2 mb-1">
                        <Handshake className="h-3 w-3 text-green-600" />
                        <span className="text-xs font-bold text-green-700 uppercase">Deal Closed — Won!</span>
                        <span className="text-xs text-gray-400">{new Date(selectedDeal.createdAt).toLocaleDateString("en-GB")}</span>
                      </div>
                      <p className="text-sm text-gray-600">
                        Deal closed by <span className="font-semibold">{selectedDeal.salesAgent.name}</span> for{" "}
                        <span className="font-bold text-green-700">{selectedDeal.totalAmount.toLocaleString()} SAR</span> ({selectedDeal.package} package, paid via {selectedDeal.paymentMethod}).
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Installments */}
              {selectedDeal.installments.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-orange-500" /> Payment Installments
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {selectedDeal.installments.map((inst) => (
                      <div key={inst.id} className={`flex items-center justify-between p-3 rounded-lg border ${inst.isPaid ? "bg-green-50 border-green-200" : "bg-orange-50 border-orange-200"}`}>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{inst.amount.toLocaleString()} SAR</p>
                          <p className="text-xs text-gray-500">Due: {new Date(inst.dueDate).toLocaleDateString("en-GB")}</p>
                        </div>
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${inst.isPaid ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
                          {inst.isPaid ? "✓ Paid" : "Pending"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
