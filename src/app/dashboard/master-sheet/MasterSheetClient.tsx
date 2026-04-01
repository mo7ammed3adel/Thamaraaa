import React, { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import { Download, Search, Filter, ChevronDown, ChevronUp, Calendar, Phone, CheckCircle, Clock } from "lucide-react";

export default function MasterSheetClient({ leads }: { leads: any[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
      const matchSearch = l.name.toLowerCase().includes(search.toLowerCase()) || 
                          l.phone.includes(search);
      const matchStatus = statusFilter === "All" || l.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [leads, search, statusFilter]);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };
  const exportToExcel = () => {
    const data = filteredLeads.map(l => {
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
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search by name or phone..." 
              className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="relative w-full md:w-48">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select 
              className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm appearance-none bg-white focus:ring-2 focus:ring-blue-500"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="All">All Statuses</option>
              <option value="New">New</option>
              <option value="In_TeleSales">In TeleSales</option>
              <option value="Transferred">Transferred</option>
              <option value="In_Sales">In Sales</option>
              <option value="Closed_Won">Closed Won</option>
              <option value="Closed_Lost">Closed Lost</option>
              <option value="Archived">Archived</option>
            </select>
          </div>
        </div>
        <button 
          onClick={exportToExcel}
          className="flex items-center justify-center w-full md:w-auto px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 shadow-sm transition"
        >
          <Download className="w-4 h-4 mr-2" />
          Export ({filteredLeads.length}) leads
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
            {filteredLeads.map((l: any) => {
              const deal = l.deals?.[0];
              const project = deal?.projects?.[0];
              return (
                <React.Fragment key={l.id}>
                  <tr 
                    className={`hover:bg-gray-50 cursor-pointer transition-colors ${expandedId === l.id ? 'bg-blue-50/50' : ''}`}
                    onClick={() => toggleExpand(l.id)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 border-l-4 border-transparent hover:border-blue-400">
                      <div className="flex items-center gap-2">
                        {expandedId === l.id ? <ChevronUp className="w-4 h-4 text-blue-500" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                        <div>
                          {l.name} <br/>
                          <span className="text-xs text-gray-500 font-normal">{l.phone}</span>
                        </div>
                      </div>
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
                  
                  {/* Expandable Timeline Panel */}
                  {expandedId === l.id && (
                    <tr className="bg-slate-50 border-b border-gray-200">
                      <td colSpan={6} className="px-6 py-6">
                        <h4 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                          <Calendar className="w-5 h-5 text-blue-500" />
                          Lead Journey Timeline
                        </h4>
                        <div className="max-w-3xl ml-2 border-l-2 border-blue-200 space-y-6">
                          {/* 1. Lead Creation */}
                          <div className="relative pl-6">
                            <span className="absolute w-3 h-3 bg-blue-500 rounded-full -left-[7px] top-1"></span>
                            <p className="text-sm font-bold text-gray-900">Lead Created <span className="text-xs font-normal text-gray-500 ml-2">{new Date(l.createdAt).toLocaleString()}</span></p>
                            <p className="text-xs text-gray-600 mt-1">Source: {l.source || 'Direct'}, Assigned to: {l.teleAgent?.name || 'Unassigned'}</p>
                          </div>

                          {/* 2. Call Logs */}
                          {l.callLogs?.map((log: any) => (
                            <div key={log.id} className="relative pl-6">
                              <span className={`absolute w-3 h-3 rounded-full -left-[7px] top-1 ${
                                log.callStatus === "Accept and book meeting" ? "bg-green-500" :
                                ["Busy", "Wrong Number", "Not Interested", "Rejected"].includes(log.callStatus) ? "bg-red-500" :
                                "bg-amber-400"
                              }`}></span>
                              <p className="text-sm font-bold text-gray-900">
                                Call / Update ({log.callStatus}) 
                                <span className="text-xs font-normal text-gray-500 ml-2">{new Date(log.createdAt).toLocaleString()}</span>
                              </p>
                              <div className="text-xs text-gray-700 bg-white border border-gray-200 rounded p-2 mt-1 shadow-sm">
                                {log.notes}
                              </div>
                            </div>
                          ))}

                          {/* 3. Meetings */}
                          {l.meetings?.map((m: any) => (
                            <div key={m.id} className="relative pl-6">
                              <span className="absolute w-3 h-3 bg-purple-500 rounded-full -left-[7px] top-1"></span>
                              <p className="text-sm font-bold text-gray-900">
                                Meeting Scheduled 
                                <span className="text-xs font-normal text-gray-500 ml-2">{new Date(m.createdAt).toLocaleString()}</span>
                              </p>
                              <p className="text-xs text-gray-600 mt-1">Date: {new Date(m.meetingDate).toLocaleDateString()} {m.meetingTime}</p>
                              {m.salesNotes && (
                                <div className="text-xs text-gray-700 bg-white border border-purple-200 rounded p-2 mt-1 shadow-sm">
                                  Sales Note: {m.salesNotes}
                                </div>
                              )}
                            </div>
                          ))}

                          {/* 4. Deals */}
                          {l.deals?.map((d: any) => (
                            <div key={d.id} className="relative pl-6 bg-green-50/50 rounded-r-lg py-2">
                              <span className="absolute w-4 h-4 bg-green-500 rounded-full -left-[9px] top-2 border-2 border-white shadow"></span>
                              <p className="text-sm font-bold text-green-800">
                                Deal Closed Won ({d.package})
                                <span className="text-xs font-normal text-green-600 ml-2">{new Date(d.createdAt).toLocaleString()}</span>
                              </p>
                              <p className="text-xs font-medium text-green-700 mt-1">
                                Revenue: {d.netTarget} SAR | Payment: {d.paymentMethod}
                              </p>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
            {filteredLeads.length === 0 && (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">No data available.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
