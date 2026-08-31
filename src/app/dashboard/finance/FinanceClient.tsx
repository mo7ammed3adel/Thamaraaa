"use client";

import { useState, useEffect, useCallback } from "react";
import { CheckCircle2 } from "lucide-react";
import { formatSar } from "@/shared/formatters/currency";
import { formatDate } from "@/shared/formatters/date";
import { getFinanceOverview, updateInstallment } from "@/client/api/finance";
import { CommissionsTab, PayrollTab } from "./FinanceTabs";
import { useTranslator } from "@/components/i18n/LocaleProvider";

export default function FinanceClient() {
  const t = useTranslator();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [activeFilter, setActiveFilter] = useState("all");

  const loadData = useCallback(() => {
    setLoading(true);
    getFinanceOverview()
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setData(null); setLoading(false); });
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleMarkInstallmentPaid = async (id: string) => {
    if (!confirm("Are you sure you want to mark this installment as Paid?")) return;
    
    await updateInstallment(id, { isPaid: true });
    
    // Refresh Data
    loadData();
  };

  if (loading) return <div className="flex justify-center p-12"><div className="animate-spin h-8 w-8 border-b-2 border-green-600 rounded-full"></div></div>;
  if (!data?.overview) return <div className="text-center p-12 text-gray-500">{t("finance.loadFailed")}</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div 
          onClick={() => setActiveFilter("all")}
          className={`cursor-pointer transition-all p-5 rounded-2xl border-2 shadow-sm ${
            activeFilter === "all" ? "border-gray-500 bg-gray-100" : "border-transparent bg-white hover:bg-gray-50 border-gray-200"
          }`}>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">{t("finance.totalRevenue")}</p>
          <p className="text-3xl font-black text-gray-900">{formatSar(data.overview.totalRevenue)}</p>
        </div>
        <div 
          onClick={() => setActiveFilter("fully_paid")}
          className={`cursor-pointer transition-all p-5 rounded-2xl border-2 shadow-sm ${
            activeFilter === "fully_paid" ? "border-green-500 bg-green-100" : "border-transparent bg-green-50 hover:bg-green-100 border-green-200"
          }`}>
          <p className="text-xs font-bold text-green-700 uppercase tracking-widest mb-2">{t("finance.totalCollected")}</p>
          <p className="text-3xl font-black text-green-700">{formatSar(data.overview.totalCollected)}</p>
        </div>
        <div 
          onClick={() => setActiveFilter("partial")}
          className={`cursor-pointer transition-all p-5 rounded-2xl border-2 shadow-sm ${
            activeFilter === "partial" ? "border-amber-500 bg-amber-100" : "border-transparent bg-amber-50 hover:bg-amber-100 border-amber-200"
          }`}>
          <p className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-2">{t("finance.totalRemaining")}</p>
          <p className="text-3xl font-black text-amber-700">{formatSar(data.overview.totalRemaining)}</p>
        </div>
        <div 
          onClick={() => { setActiveTab("installments"); setActiveFilter("overdue"); }}
          className={`cursor-pointer transition-all p-5 rounded-2xl border-2 shadow-sm ${
            activeFilter === "overdue" && activeTab === "installments" ? "border-blue-500 bg-blue-100" : "border-transparent bg-blue-50 hover:bg-blue-100 border-blue-200"
          }`}>
          <p className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-2">{t("finance.upcomingInstallments")}</p>
          <p className="text-3xl font-black text-blue-700">{formatSar(data.overview.upcomingAmounts)}</p>
        </div>
      </div>

      <div className="flex border-b border-gray-200">
        <button onClick={() => { setActiveTab("overview"); setActiveFilter("all"); }} className={`px-6 py-3 font-semibold text-sm border-b-2 transition ${activeTab === "overview" ? "border-green-600 text-green-600" : "border-transparent text-gray-500"}`}>
          💰 All Deals
        </button>
        <button onClick={() => { setActiveTab("installments"); setActiveFilter("all"); }} className={`px-6 py-3 font-semibold text-sm border-b-2 transition ${activeTab === "installments" ? "border-green-600 text-green-600" : "border-transparent text-gray-500"}`}>
          📆 Pending Installments
        </button>
        <button onClick={() => { setActiveTab("commissions"); setActiveFilter("all"); }} className={`px-6 py-3 font-semibold text-sm border-b-2 transition ${activeTab === "commissions" ? "border-green-600 text-green-600" : "border-transparent text-gray-500"}`}>
          🧮 Commissions
        </button>
        <button onClick={() => { setActiveTab("payroll"); setActiveFilter("all"); }} className={`px-6 py-3 font-semibold text-sm border-b-2 transition ${activeTab === "payroll" ? "border-green-600 text-green-600" : "border-transparent text-gray-500"}`}>
          Payroll
        </button>
      </div>

      {activeTab === "commissions" && <CommissionsTab />}
      {activeTab === "payroll" && <PayrollTab />}

      {activeTab === "overview" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 text-xs font-medium text-gray-500 uppercase">
              <tr>
                <th className="px-6 py-3 text-start">{t("finance.clientAgent")}</th>
                <th className="px-6 py-3 text-start">{t("finance.totalValue")}</th>
                <th className="px-6 py-3 text-start">{t("finance.collected")}</th>
                <th className="px-6 py-3 text-start">{t("common.status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-sm">
              {data.deals.map((d: any) => {
                const installmentsPaid = (d.installments || [])
                  .filter((inst: any) => inst.isPaid)
                  .reduce((sum: number, inst: any) => sum + inst.amount, 0);
                const collected = (d.firstAmount || 0) + installmentsPaid;

                const isFullyPaid = collected >= d.totalAmount;
                if (activeFilter === "fully_paid" && !isFullyPaid) return null;
                if (activeFilter === "partial" && isFullyPaid) return null;

                return (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900">{d.lead?.name || "Unknown"}</div>
                      <div className="text-xs text-gray-500">Agent: {d.salesAgent?.name || "N/A"}</div>
                    </td>
                    <td className="px-6 py-4 font-bold text-gray-900">{formatSar(d.totalAmount)}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-green-600">{formatSar(collected)}</span>
                        {collected < d.totalAmount && (
                          <span className="text-xs text-amber-600 mt-1">Remaining: {formatSar(d.totalAmount - collected)}</span>
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
              {data.deals.length === 0 && <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500 italic">{t("finance.noDeals")}</td></tr>}
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
                  <p className="text-3xl font-black text-gray-900">{formatSar(inst.amount)}</p>
                  <p className="text-sm font-medium text-gray-500 mt-1">Due: {formatDate(inst.dueDate)}</p>
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

