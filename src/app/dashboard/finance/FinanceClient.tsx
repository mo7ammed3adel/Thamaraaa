"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DollarSign, AlertCircle, FileText, CheckCircle2 } from "lucide-react";

export default function FinanceClient() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    fetch("/api/finance/overview")
      .then(res => res.json())
      .then(d => {
        setData(d);
        setLoading(false);
      });
  }, []);

  const handleMarkInstallmentPaid = async (id: string) => {
    if (!confirm("Are you sure you want to mark this installment as Paid?")) return;
    
    await fetch(`/api/finance/installments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPaid: true })
    });
    
    // Refresh Data
    setLoading(true);
    fetch("/api/finance/overview")
      .then(res => res.json())
      .then(d => {
        setData(d);
        setLoading(false);
      });
  };

  if (loading) return <div className="flex justify-center p-12"><div className="animate-spin h-8 w-8 border-b-2 border-green-600 rounded-full"></div></div>;
  if (!data?.overview) return <div className="text-center p-12 text-gray-500">Failed to load finance data.</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Total Revenue</p>
          <p className="text-3xl font-black text-gray-900">SAR {data.overview.totalRevenue.toLocaleString()}</p>
        </div>
        <div className="bg-green-50 p-5 rounded-2xl border border-green-200 shadow-sm">
          <p className="text-xs font-bold text-green-700 uppercase tracking-widest mb-2">Total Collected</p>
          <p className="text-3xl font-black text-green-700">SAR {data.overview.totalCollected.toLocaleString()}</p>
        </div>
        <div className="bg-amber-50 p-5 rounded-2xl border border-amber-200 shadow-sm">
          <p className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-2">Total Remaining</p>
          <p className="text-3xl font-black text-amber-700">SAR {data.overview.totalRemaining.toLocaleString()}</p>
        </div>
        <div className="bg-blue-50 p-5 rounded-2xl border border-blue-200 shadow-sm">
          <p className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-2">Upcoming Installments</p>
          <p className="text-3xl font-black text-blue-700">SAR {data.overview.upcomingAmounts.toLocaleString()}</p>
        </div>
      </div>

      <div className="flex border-b border-gray-200">
        <button onClick={() => setActiveTab("overview")} className={`px-6 py-3 font-semibold text-sm border-b-2 transition ${activeTab === "overview" ? "border-green-600 text-green-600" : "border-transparent text-gray-500"}`}>
          💰 All Deals
        </button>
        <button onClick={() => setActiveTab("installments")} className={`px-6 py-3 font-semibold text-sm border-b-2 transition ${activeTab === "installments" ? "border-green-600 text-green-600" : "border-transparent text-gray-500"}`}>
          📆 Pending Installments
        </button>
      </div>

      {activeTab === "overview" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 text-xs font-medium text-gray-500 uppercase">
              <tr>
                <th className="px-6 py-3 text-left">Client & Agent</th>
                <th className="px-6 py-3 text-left">Total Value</th>
                <th className="px-6 py-3 text-left">Collected</th>
                <th className="px-6 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-sm">
              {data.deals.map((d: any) => {
                let collected = d.firstAmount || 0;
                if (d.installment1Collected) collected += d.installment1Amount || 0;
                if (d.installment2Collected) collected += d.installment2Amount || 0;
                if (d.installment3Collected) collected += d.installment3Amount || 0;

                return (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900">{d.lead?.name || "Unknown"}</div>
                      <div className="text-xs text-gray-500">Agent: {d.salesAgent?.name || "N/A"}</div>
                    </td>
                    <td className="px-6 py-4 font-bold text-gray-900">SAR {d.totalAmount.toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-green-600">SAR {collected.toLocaleString()}</span>
                        {collected < d.totalAmount && (
                          <span className="text-xs text-amber-600 mt-1">Remaining: SAR {(d.totalAmount - collected).toLocaleString()}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${collected >= d.totalAmount ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                        {collected >= d.totalAmount ? "Fully Paid" : "Partial"}
                      </span>
                    </td>
                  </tr>
                )
              })}
              {data.deals.length === 0 && <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500 italic">No deals recorded yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "installments" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.pendingInstallments.map((inst: any) => {
            const isOverdue = new Date(inst.dueDate) < new Date();
            return (
              <div key={inst.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 hover:shadow-md transition">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-gray-900">{inst.deal?.lead?.name || "Unknown Client"}</h3>
                    <p className="text-xs font-semibold text-gray-500 uppercase">Installment #{inst.installmentNumber}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${isOverdue ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                    {isOverdue ? "Overdue" : "Pending"}
                  </span>
                </div>
                <div className="mb-4">
                  <p className="text-3xl font-black text-gray-900">SAR {inst.amount.toLocaleString()}</p>
                  <p className="text-sm font-medium text-gray-500 mt-1">Due: {new Date(inst.dueDate).toLocaleDateString()}</p>
                </div>
                <button 
                  onClick={() => handleMarkInstallmentPaid(inst.id)}
                  className="w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-bold shadow-sm transition flex justify-center items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" /> Mark as Paid
                </button>
              </div>
            )
          })}
          {data.pendingInstallments.length === 0 && (
            <div className="col-span-full bg-gray-50 border border-dashed border-gray-300 rounded-2xl p-12 text-center text-gray-500 italic">
              No pending installments found!
            </div>
          )}
        </div>
      )}
    </div>
  );
}
