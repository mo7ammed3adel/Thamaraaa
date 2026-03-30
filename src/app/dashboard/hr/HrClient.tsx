"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function HrClient({ isManager, myTodayAttendance, history }: any) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleAttendance = async (action: "checkIn" | "checkOut") => {
    setLoading(true);
    await fetch("/api/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action })
    });
    setLoading(false);
    router.refresh();
  };

  return (
    <div className="space-y-8">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-1">Today's Attendance</h2>
          {myTodayAttendance ? (
            <p className="text-sm text-gray-500">
              Checked in at: {new Date(myTodayAttendance.checkIn).toLocaleTimeString()}
              {myTodayAttendance.checkOut && ` • Checked out at: ${new Date(myTodayAttendance.checkOut).toLocaleTimeString()}`}
            </p>
          ) : (
            <p className="text-sm text-gray-500">You haven't checked in yet today.</p>
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
              {isManager && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Check In</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Check Out</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Delay (Mins)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {history.map((h: any) => (
              <tr key={h.id}>
                {isManager && <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{h.user.name} <span className="text-xs text-gray-400 capitalize">({h.user.role.replace(/_/g, " ")})</span></td>}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(h.date).toLocaleDateString()}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(h.checkIn).toLocaleTimeString()}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{h.checkOut ? new Date(h.checkOut).toLocaleTimeString() : <span className="text-yellow-600">Active</span>}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600">{h.lateMinutes > 0 ? h.lateMinutes : <span className="text-green-600">On Time</span>}</td>
              </tr>
            ))}
            {history.length === 0 && (
              <tr><td colSpan={isManager ? 5 : 4} className="px-6 py-8 text-center text-sm text-gray-500">No attendance records found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
