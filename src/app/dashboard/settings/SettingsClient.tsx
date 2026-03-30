"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SettingsClient({ initialConfigs, initialCommissions = [] }: { initialConfigs: any[], initialCommissions?: any[] }) {
  const router = useRouter();
  const [configs, setConfigs] = useState(initialConfigs);
  const [commissions, setCommissions] = useState(initialCommissions);
  const [loading, setLoading] = useState(false);

  const handleUpdate = async (key: string, value: string) => {
    setLoading(true);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value })
    });
    setLoading(false);
    router.refresh();
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-base font-semibold text-gray-900">Global Settings</h3>
      </div>
      <div className="p-6">
        <table className="min-w-full divide-y divide-gray-200">
          <tbody className="divide-y divide-gray-200">
            {configs.map((c: any) => (
              <tr key={c.id}>
                <td className="py-4 whitespace-nowrap text-sm font-medium text-gray-900">{c.key}</td>
                <td className="py-4 whitespace-nowrap text-sm text-gray-500">
                  <input 
                    type="text" 
                    defaultValue={c.value}
                    onBlur={(e) => {
                      if (e.target.value !== c.value) {
                        handleUpdate(c.key, e.target.value);
                      }
                    }}
                    className="border px-3 py-1.5 rounded text-sm w-full max-w-xs focus:ring-blue-500 focus:border-blue-500 outline-none" 
                  />
                </td>
              </tr>
            ))}
            {configs.length === 0 && (
              <tr>
                <td colSpan={2} className="py-8 text-center text-sm text-gray-500">No system configurations found.</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Quick Add config utility */}
        <div className="mt-8 pt-6 border-t border-gray-100">
          <h4 className="text-sm font-semibold mb-3">Add New Parameter</h4>
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              handleUpdate(form.keyName.value, form.keyValue.value);
              form.reset();
            }}
            className="flex gap-3"
          >
            <input required name="keyName" type="text" placeholder="Key (e.g. gateway_fee_pct)" className="border px-3 py-2 rounded text-sm w-64" />
            <input required name="keyValue" type="text" placeholder="Value (e.g. 0.07)" className="border px-3 py-2 rounded text-sm w-64" />
            <button disabled={loading} type="submit" className="px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded hover:bg-slate-900 transition">
              Save
            </button>
          </form>
        </div>
      </div>
      
      {/* Commission Rules Module */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mt-8">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 rounded-t-xl">
          <h3 className="text-base font-semibold text-gray-900">Dynamic Commission Rules</h3>
          <p className="text-xs text-gray-500 mt-1">Set the final commission percentage (e.g. 0.05 for 5%) that each role instantly receives when targets are hit.</p>
        </div>
        <div className="p-6">
          <table className="min-w-full divide-y divide-gray-200">
            <tbody className="divide-y divide-gray-200">
              {commissions.map((c: any) => (
                <tr key={c.id}>
                  <td className="py-4 whitespace-nowrap text-sm font-bold text-gray-800 capitalize">{c.role.replace(/_/g, " ")}</td>
                  <td className="py-4 whitespace-nowrap text-sm text-gray-500">
                    <input 
                      type="number" 
                      step="0.01"
                      defaultValue={c.percentage}
                      onBlur={async (e) => {
                        if (parseFloat(e.target.value) !== c.percentage) {
                          setLoading(true);
                          await fetch("/api/settings/commissions", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ role: c.role, percentage: e.target.value })
                          });
                          setLoading(false);
                          router.refresh();
                        }
                      }}
                      className="border px-3 py-1.5 rounded text-sm w-32 focus:ring-blue-500 focus:border-blue-500 outline-none" 
                    />
                  </td>
                </tr>
              ))}
              {commissions.length === 0 && (
                <tr>
                  <td colSpan={2} className="py-8 text-center text-sm text-gray-500">No commission rules set.</td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="mt-8 pt-6 border-t border-gray-100">
            <h4 className="text-sm font-semibold mb-3">Add / Update Rule</h4>
            <form 
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                setLoading(true);
                await fetch("/api/settings/commissions", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ role: form.roleName.value, percentage: form.percentageVal.value })
                });
                form.reset();
                setLoading(false);
                router.refresh();
              }}
              className="flex gap-3"
            >
              <input required name="roleName" type="text" placeholder="Role (e.g. sales_agent)" className="border px-3 py-2 rounded text-sm w-64" />
              <input required name="percentageVal" type="number" step="0.01" placeholder="Percentage (e.g. 0.05)" className="border px-3 py-2 rounded text-sm w-48" />
              <button disabled={loading} type="submit" className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition">
                Create Rule
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
