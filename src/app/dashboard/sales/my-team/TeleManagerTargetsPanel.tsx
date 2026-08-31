"use client";
import { useState } from "react";
import { notify } from "@/components/toast";
import { PhoneCall } from "lucide-react";
import { updateUserTarget } from "@/client/api/users";

interface TeleManager {
  id: string;
  name: string;
  email: string;
  status: string;
  target: number;
  achieved: number;
}

export default function TeleManagerTargetsPanel({ managers: initialManagers }: { managers: TeleManager[] }) {
  const [managers, setManagers] = useState(initialManagers);

  const updateTarget = async (managerId: string, newTarget: number) => {
    try {
      await updateUserTarget(managerId, { target: newTarget });
      setManagers((current) => current.map(m => (m.id === managerId ? { ...m, target: newTarget } : m)));
      notify("Monthly target updated");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Network error");
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
      <div className="px-6 py-3 bg-indigo-50 border-b border-indigo-100 flex items-center gap-2">
        <PhoneCall className="h-4 w-4 text-indigo-600" />
        <h2 className="text-sm font-bold text-indigo-800">TeleSales Manager - Monthly Meetings Target</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">Manager</th>
              <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">Team Actual Meetings (Month)</th>
              <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">Monthly Target</th>
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
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-purple-700">{m.achieved}</span>
                    {m.target > 0 && (
                      <div className="w-24 bg-gray-200 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${
                            m.achieved / m.target >= 1 ? "bg-green-500" : m.achieved / m.target >= 0.5 ? "bg-yellow-400" : "bg-red-400"
                          }`}
                          style={{ width: `${Math.min(100, (m.achieved / m.target) * 100)}%` }}
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
                    className="w-20 border border-gray-200 rounded-md px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-500"
                    title="Meetings target for the current month"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
