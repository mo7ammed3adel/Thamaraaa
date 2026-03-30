"use client";

import * as XLSX from "xlsx";
import { Download } from "lucide-react";

export default function MasterSheetClient({ leads }: { leads: any[] }) {
  const exportToExcel = () => {
    const data = leads.map(l => {
      const deal = l.deals?.[0];
      const project = deal?.projects?.[0];
      
      return {
        "Lead Name": l.name,
        "Phone": l.phone,
        "Source": l.source || "N/A",
        "Classification": l.classification,
        "Lead Status": l.status,
        "Tele-Sales Agent": l.teleAgent?.name || "Unassigned",
        "Sales Agent": l.salesAgent?.name || "Unassigned",
        "Meeting Date": l.meetingDate ? new Date(l.meetingDate).toLocaleDateString() : "N/A",
        "Package": deal?.package || "No Deal",
        "Total Amount": deal?.totalAmount || 0,
        "Net Target": deal?.netTarget || 0,
        "Payment Method": deal?.paymentMethod || "N/A",
        "Account Manager": project?.accountManager?.name || "N/A",
        "Ops Status": project?.finalStatus || "N/A",
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Master Sheet");
    XLSX.writeFile(workbook, "Thamaraa_Master_Sheet.xlsx");
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button 
          onClick={exportToExcel}
          className="flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 shadow transition"
        >
          <Download className="w-4 h-4 mr-2" />
          Export to Excel
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-slate-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Customer</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Status & Agents</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Package</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Finances (SAR)</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Account Manager</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">Ops Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {leads.map((l: any) => {
              const deal = l.deals?.[0];
              const project = deal?.projects?.[0];
              return (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {l.name} <br/>
                    <span className="text-xs text-gray-500 font-normal">{l.phone}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${l.status === 'Closed_Won' ? 'bg-green-100 text-green-800' : l.status === 'Closed_Lost' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                      {l.status}
                    </span><br/>
                    <span className="text-xs mt-1 block">Tele: {l.teleAgent?.name || "-"}</span>
                    <span className="text-xs block">Sales: {l.salesAgent?.name || "-"}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {deal ? <span className="bg-purple-100 text-purple-800 text-xs px-2 py-0.5 rounded font-medium">{deal.package}</span> : "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {deal ? (
                      <>
                        Gross: {deal.totalAmount}<br/>
                        Net: <span className="text-green-600 font-medium">{deal.netTarget}</span><br/>
                        Method: {deal.paymentMethod}
                      </>
                    ) : "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {project ? project.accountManager?.name : "Unassigned"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {project ? (
                      <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded font-medium">{project.finalStatus}</span>
                    ) : (
                      deal ? <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5 rounded font-medium">Pending Ops</span> : "-"
                    )}
                  </td>
                </tr>
              )
            })}
            {leads.length === 0 && (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">No data available.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
