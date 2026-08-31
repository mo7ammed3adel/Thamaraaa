"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitAttendance } from "@/client/api/hr";
import { SelfServiceSection } from "./HrWorkflowTabs";
import HrSelfServiceExtras from "./HrSelfServiceExtras";
import HrSalaryEvalCard from "./HrSalaryEvalCard";
import HrMyTasks from "./HrMyTasks";
import { useTranslator } from "@/components/i18n/LocaleProvider";

/**
 * Employee view of the HR / Attendance page (every non-HR-manager user).
 * The HR Manager's dashboard lives in HrAdminClient — this file deliberately
 * only carries the employee attendance + self-service experience.
 */
export default function HrClient({ myTodayAttendance, history, salaryInfo }: any) {
  const t = useTranslator();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleAttendance = async (action: "checkIn" | "checkOut") => {
    setLoading(true);
    await submitAttendance({ action });
    setLoading(false);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-1">{t("hr.todaysAttendance")}</h2>
          {myTodayAttendance ? (
            <p className="text-sm text-gray-500">
              Checked in at: {new Date(myTodayAttendance.checkIn).toLocaleTimeString()}
              {myTodayAttendance.checkOut && ` • Checked out at: ${new Date(myTodayAttendance.checkOut).toLocaleTimeString()}`}
            </p>
          ) : (
            <p className="text-sm text-gray-500">{t("hr.notCheckedIn")}</p>
          )}
        </div>
        <div className="flex gap-4">
          <button
            disabled={loading || !!myTodayAttendance}
            onClick={() => handleAttendance("checkIn")}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-50 transition"
          >
            Check In
          </button>
          <button
            disabled={loading || !myTodayAttendance || !!myTodayAttendance.checkOut}
            onClick={() => handleAttendance("checkOut")}
            className="px-6 py-2 bg-slate-600 hover:bg-slate-700 text-white font-medium rounded-lg disabled:opacity-50 transition"
          >
            Check Out
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase">{t("common.date")}</th>
              <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase">{t("hr.checkIn")}</th>
              <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase">{t("hr.checkOut")}</th>
              <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase">{t("hr.delayMinutes")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {(history || []).map((h: any) => (
              <tr key={h.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(h.date).toLocaleDateString()}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(h.checkIn).toLocaleTimeString()}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{h.checkOut ? new Date(h.checkOut).toLocaleTimeString() : <span className="text-yellow-600">{t("status.active")}</span>}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600">{h.lateMinutes > 0 ? h.lateMinutes : <span className="text-green-600">{t("hr.onTime")}</span>}</td>
              </tr>
            ))}
            {(history || []).length === 0 && (
              <tr><td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-500">{t("hr.noAttendanceRecords")}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {salaryInfo && <HrSalaryEvalCard info={salaryInfo} />}
      <HrMyTasks />
      <SelfServiceSection />
      <HrSelfServiceExtras />
    </div>
  );
}
