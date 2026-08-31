"use client";
import { useState } from "react";
import { notify } from "@/components/toast";
import { Users, DollarSign } from "lucide-react";
import { updateUserTarget } from "@/client/api/users";
import { formatSarSuffix } from "@/shared/formatters/currency";
import { useTranslator } from "@/components/i18n/LocaleProvider";

interface SalesManager {
  id: string;
  name: string;
  email: string;
  status: string;
  target: number;
  achievedFund: number;
  teamSize: number;
}

export default function SalesManagerTargetsClient({ managers: initialManagers }: { managers: SalesManager[] }) {
  const t = useTranslator();
  const [managers, setManagers] = useState(initialManagers);

  const updateTarget = async (managerId: string, newTarget: number) => {
    try {
      await updateUserTarget(managerId, { target: newTarget });
      setManagers((current) => current.map(m => (m.id === managerId ? { ...m, target: newTarget } : m)));
      notify("Monthly fund target updated");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Network error");
    }
  };

  const totalFund = managers.reduce((s, m) => s + m.achievedFund, 0);
  const totalTarget = managers.reduce((s, m) => s + m.target, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-4 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-5 w-5 opacity-80" />
            <span className="text-xs font-semibold uppercase opacity-80">{t("chief.monthFund")}</span>
          </div>
          <p className="text-3xl font-bold">{formatSarSuffix(totalFund, { maximumFractionDigits: 0 })}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2 text-gray-500">
            <Users className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase">{t("chief.combinedTarget")}</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{formatSarSuffix(totalTarget, { maximumFractionDigits: 0 })}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">{t("common.manager")}</th>
                <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">{t("common.status")}</th>
                <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">{t("chief.teamSize")}</th>
                <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">{t("chief.monthFundSar")}</th>
                <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">{t("form.monthlyFundTarget")}</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {managers.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <p className="text-sm font-semibold text-gray-900">{m.name}</p>
                    <p className="text-xs text-gray-400">{m.email}</p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      m.status === "Active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
                    }`}>
                      {m.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{m.teamSize}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-emerald-700">{formatSarSuffix(m.achievedFund, { maximumFractionDigits: 0 })}</span>
                      {m.target > 0 && (
                        <div className="w-24 bg-gray-200 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${
                              m.achievedFund / m.target >= 1 ? "bg-green-500" : m.achievedFund / m.target >= 0.5 ? "bg-yellow-400" : "bg-red-400"
                            }`}
                            style={{ width: `${Math.min(100, (m.achievedFund / m.target) * 100)}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="number"
                      min={0}
                      defaultValue={m.target}
                      onBlur={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        if (val !== m.target) updateTarget(m.id, val);
                      }}
                      className="w-28 border border-gray-200 rounded-md px-2 py-1 text-sm focus:ring-2 focus:ring-emerald-500"
                      title={t("form.fundTargetHint")}
                    />
                  </td>
                </tr>
              ))}
              {managers.length === 0 && (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">{t("chief.noManagers")}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
