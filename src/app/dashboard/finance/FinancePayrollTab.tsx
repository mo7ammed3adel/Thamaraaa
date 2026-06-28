import { useState, useEffect, useCallback } from "react";
import { ReceiptText } from "lucide-react";
import { formatSar } from "@/shared/formatters/currency";
import { listFinancePayroll } from "@/client/api/finance";

export function PayrollTab() {
  const today = new Date();
  const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const [month, setMonth] = useState<string>(defaultMonth);
  const [payroll, setPayroll] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    listFinancePayroll(month)
      .then((d) => setPayroll(d))
      .catch(() => setPayroll(null))
      .finally(() => setLoading(false));
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const rows = payroll?.rows || [];
  const totals = payroll?.totals || { baseSalary: 0, commissionAmount: 0, bonuses: 0, deductions: 0, net: 0 };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl border p-4 shadow-sm">
        <ReceiptText className="w-5 h-5 text-slate-500" />
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white" />
        <button onClick={load} className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold rounded-lg">
          Refresh Payroll
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <PayrollKpi label="Base Salaries" value={totals.baseSalary} />
        <PayrollKpi label="Commissions" value={totals.commissionAmount} />
        <PayrollKpi label="Bonuses" value={totals.bonuses} />
        <PayrollKpi label="Net Payroll" value={totals.net} tone="green" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 text-xs font-medium text-gray-500 uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Employee</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-right">Base Salary</th>
              <th className="px-4 py-3 text-right">Commission</th>
              <th className="px-4 py-3 text-right">Bonuses</th>
              <th className="px-4 py-3 text-right">Deductions</th>
              <th className="px-4 py-3 text-right">Net</th>
              <th className="px-4 py-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 text-sm">
            {loading && <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400 italic">No payroll rows for {month}.</td></tr>}
            {!loading && rows.map((row: any) => (
              <tr key={row.userId} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="font-bold text-gray-900">{row.name}</div>
                  <div className="text-xs text-gray-500">{row.email}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="font-semibold text-gray-800">{formatRole(row.role)}</div>
                  <div className="text-xs text-gray-400">{row.level || "—"}</div>
                </td>
                <td className="px-4 py-3 text-right">{formatSar(row.baseSalary, { maximumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-right">{formatSar(row.commissionAmount, { maximumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-right text-emerald-700">{formatSar(row.bonuses, { maximumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-right">
                  <div className="text-red-600">{formatSar(row.deductions, { maximumFractionDigits: 2 })}</div>
                  {(row.attendanceDeductions || row.commissionDeductions) > 0 && (
                    <div className="text-[11px] text-gray-400">
                      Attendance {formatSar(row.attendanceDeductions, { maximumFractionDigits: 2 })} / Manual {formatSar(row.commissionDeductions, { maximumFractionDigits: 2 })}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-black">{formatSar(row.net, { maximumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${row.finalized ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                    {row.finalized ? "Finalized" : "Open"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PayrollKpi({ label, value, tone = "slate" }: { label: string; value: number; tone?: "slate" | "green" }) {
  const cls = tone === "green" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-white border-gray-200 text-gray-900";
  return (
    <div className={`p-5 rounded-2xl border shadow-sm ${cls}`}>
      <p className="text-xs font-bold uppercase tracking-widest mb-2 opacity-70">{label}</p>
      <p className="text-2xl font-black">{formatSar(value, { maximumFractionDigits: 2 })}</p>
    </div>
  );
}


function formatRole(role: string | null | undefined) {
  return String(role || "unknown").replace(/_/g, " ");
}
