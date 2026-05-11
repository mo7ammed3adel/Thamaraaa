"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Pencil, Check, PhoneCall, CheckCircle2, PhoneOff, XCircle, CalendarDays } from "lucide-react";

interface CustomColumn {
  id: string;
  name: string;
  values: { id: string; columnId: string; leadId: string; value: string }[];
}

export default function TeleSalesClient({
  initialLeads,
  userRole,
  userId,
  initialCustomColumns,
  activeAgents = [],
}: {
  initialLeads: any[];
  userRole: string;
  userId: string;
  initialCustomColumns?: CustomColumn[];
  activeAgents?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [leads, setLeads] = useState(initialLeads);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [logData, setLogData] = useState({
    callStatus: "Accept but lost",
    notes: "",
    meetingDate: "",
    meetingTime: "",
  });
  const [loading, setLoading] = useState(false);

  // Custom Columns
  const [customColumns, setCustomColumns] = useState<CustomColumn[]>(initialCustomColumns || []);
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [addingColumn, setAddingColumn] = useState(false);
  const [editingCell, setEditingCell] = useState<{ columnId: string; leadId: string } | null>(null);
  const [editValue, setEditValue] = useState("");

  // Filters
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterClass, setFilterClass] = useState("All");
  const [filterDate, setFilterDate] = useState("All");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [logFilter, setLogFilter] = useState("All");

  // Search & Pagination
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const isManager = userRole === "tele_sales_manager" || userRole === "super_admin";

  const handleDeleteLead = async (leadId: string) => {
    if (!confirm("Are you sure you want to delete this lead?")) return;
    try {
      const res = await fetch(`/api/leads/${leadId}`, { method: "DELETE" });
      if (res.ok) {
        setLeads(leads.filter((l) => l.id !== leadId));
        router.refresh();
      } else {
        alert("Failed to delete lead");
      }
    } catch {
      alert("Network error");
    }
  };

  const handleReassignLead = async (leadId: string, newAgentId: string) => {
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedTeleAgentId: newAgentId || null })
      });
      if (res.ok) {
        const newlyAssignedAgent = activeAgents.find(a => a.id === newAgentId);
        setLeads(leads.map(l => l.id === leadId ? { ...l, assignedTeleAgentId: newAgentId, teleAgent: newlyAssignedAgent || null } : l));
        router.refresh();
      } else {
        alert("Failed to reassign lead");
      }
    } catch {
      alert("Network err");
    }
  };

  const handleLogCall = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/call-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: selectedLead.id,
          classification: selectedLead.classification,
          ...logData,
        }),
      });

      if (res.ok) {
        const updatedLead = await res.json();
        // Update local state first with the full lead data (includes callLogs)
        setLeads(leads.map((l) => (l.id === updatedLead.id ? updatedLead : l)));
        setSelectedLead(null);
        setLogData({ callStatus: "Accept but lost", notes: "", meetingDate: "", meetingTime: "" });
        // Then refresh server data in the background
        router.refresh();
      } else {
        const errData = await res.json();
        alert(`Error logging call: ${errData.error || "Unknown error"}`);
      }
    } catch {
      alert("Network error. Please try again.");
    }
    setLoading(false);
  };

  // Custom Column handlers
  const handleAddColumn = async () => {
    if (!newColumnName.trim()) return;
    setAddingColumn(true);
    try {
      const res = await fetch("/api/custom-columns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newColumnName.trim() }),
      });
      if (res.ok) {
        const col = await res.json();
        setCustomColumns([...customColumns, col]);
        setNewColumnName("");
        setShowAddColumn(false);
      } else {
        alert("Failed to add column");
      }
    } catch {
      alert("Network error");
    }
    setAddingColumn(false);
  };

  const handleDeleteColumn = async (colId: string) => {
    if (!confirm("Are you sure you want to delete this column?")) return;
    try {
      const res = await fetch(`/api/custom-columns?id=${colId}`, { method: "DELETE" });
      if (res.ok) {
        setCustomColumns(customColumns.filter((c) => c.id !== colId));
      }
    } catch {
      alert("Failed to delete column");
    }
  };

  const handleSaveCellValue = async (columnId: string, leadId: string) => {
    try {
      await fetch("/api/custom-columns/values", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columnId, leadId, value: editValue }),
      });
      // Update local state
      setCustomColumns(
        customColumns.map((col) => {
          if (col.id !== columnId) return col;
          const existingIdx = col.values.findIndex((v) => v.leadId === leadId);
          if (existingIdx >= 0) {
            const newValues = [...col.values];
            newValues[existingIdx] = { ...newValues[existingIdx], value: editValue };
            return { ...col, values: newValues };
          } else {
            return { ...col, values: [...col.values, { id: "temp", columnId, leadId, value: editValue }] };
          }
        })
      );
    } catch {
      alert("Failed to save value");
    }
    setEditingCell(null);
    setEditValue("");
  };

  const getColumnValue = (columnId: string, leadId: string): string => {
    const col = customColumns.find((c) => c.id === columnId);
    const val = col?.values.find((v) => v.leadId === leadId);
    return val?.value || "";
  };

  // Date range helper
  const getDateRange = useMemo(() => {
    const now = new Date();
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const ranges: Record<string, { from: Date; to: Date }> = {
      Today: { from: startOfDay(now), to: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59) },
      Yesterday: (() => { const y = new Date(now); y.setDate(y.getDate() - 1); return { from: startOfDay(y), to: new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59) }; })(),
      "This Week": (() => { const d = new Date(now); d.setDate(d.getDate() - d.getDay()); return { from: startOfDay(d), to: now }; })(),
      "This Month": { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now },
      "Last 7 Days": (() => { const d = new Date(now); d.setDate(d.getDate() - 7); return { from: startOfDay(d), to: now }; })(),
      "Last 30 Days": (() => { const d = new Date(now); d.setDate(d.getDate() - 30); return { from: startOfDay(d), to: now }; })(),
    };
    return ranges;
  }, []);

  // Apply filters
  const filteredLeads = leads.filter((l) => {
    if (filterStatus !== "All" && l.status !== filterStatus) return false;
    if (filterClass !== "All" && l.classification !== filterClass) return false;

    if (filterDate !== "All") {
      const leadDate = new Date(l.createdAt);
      if (filterDate === "Custom") {
        if (customFrom && leadDate < new Date(customFrom)) return false;
        if (customTo) {
          const toEnd = new Date(customTo);
          toEnd.setHours(23, 59, 59);
          if (leadDate > toEnd) return false;
        }
      } else {
        const range = getDateRange[filterDate];
        if (range) {
          if (leadDate < range.from || leadDate > range.to) return false;
        }
      }
    }

    if (logFilter !== "All") {
      if (logFilter === "Accept and book meeting") {
        // Meeting-booked leads should remain in this bucket even after follow-up call logs.
        const hasBookedMeeting = !!l.meetingDate ||
          ["Transferred", "In_Sales", "Closed_Won"].includes(l.status);
        if (!hasBookedMeeting) return false;
      } else {
        const lastLog = l.callLogs?.[0]?.callStatus;
        if (lastLog !== logFilter) return false;
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!l.name.toLowerCase().includes(q) && !l.phone.includes(q)) return false;
    }

    return true;
  });

  // Calculate pagination
  const totalPages = Math.ceil(filteredLeads.length / pageSize) || 1;
  const paginatedLeads = filteredLeads.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const totalCount = leads.length;
  const acceptLostCount = leads.filter(l => l.callLogs?.[0]?.callStatus === "Accept but lost").length;
  // A booked meeting stays counted even after follow-up call logs change the latest status.
  const acceptBookCount = leads.filter(l =>
    !!l.meetingDate || ["Transferred", "In_Sales", "Closed_Won"].includes(l.status)
  ).length;
  const busyCount = leads.filter(l => l.callLogs?.[0]?.callStatus === "Busy").length;
  const wrongNumberCount = leads.filter(l => l.callLogs?.[0]?.callStatus === "Wrong Number").length;

  return (
    <div className="space-y-6">
      {/* Workspace Summary Filters */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div 
          onClick={() => { setLogFilter(logFilter === "All" ? "All" : "All"); setCurrentPage(1); }} 
          className={`cursor-pointer rounded-xl p-4 shadow-sm transition-all border-2 ${logFilter === "All" ? "border-blue-500 bg-blue-50" : "border-transparent bg-white hover:bg-gray-50"}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <PhoneCall className="h-5 w-5 text-blue-500" />
            <span className="text-xs font-bold uppercase text-gray-500">Total Leads</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{totalCount}</p>
        </div>

        <div 
          onClick={() => { setLogFilter(logFilter === "Accept and book meeting" ? "All" : "Accept and book meeting"); setCurrentPage(1); }} 
          className={`cursor-pointer rounded-xl p-4 shadow-sm transition-all border-2 ${logFilter === "Accept and book meeting" ? "border-green-500 bg-green-50" : "border-transparent bg-white hover:bg-gray-50"}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <span className="text-xs font-bold uppercase text-gray-500">Accept & Booked</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{acceptBookCount}</p>
        </div>

        <div 
          onClick={() => { setLogFilter(logFilter === "Accept but lost" ? "All" : "Accept but lost"); setCurrentPage(1); }} 
          className={`cursor-pointer rounded-xl p-4 shadow-sm transition-all border-2 ${logFilter === "Accept but lost" ? "border-orange-500 bg-orange-50" : "border-transparent bg-white hover:bg-gray-50"}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="h-5 w-5 text-orange-500" />
            <span className="text-xs font-bold uppercase text-gray-500">Accept But Lost</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{acceptLostCount}</p>
        </div>

        <div 
          onClick={() => { setLogFilter(logFilter === "Busy" ? "All" : "Busy"); setCurrentPage(1); }} 
          className={`cursor-pointer rounded-xl p-4 shadow-sm transition-all border-2 ${logFilter === "Busy" ? "border-slate-500 bg-slate-50" : "border-transparent bg-white hover:bg-gray-50"}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <PhoneOff className="h-5 w-5 text-slate-500" />
            <span className="text-xs font-bold uppercase text-gray-500">Busy</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{busyCount}</p>
        </div>

        <div 
          onClick={() => { setLogFilter(logFilter === "Wrong Number" ? "All" : "Wrong Number"); setCurrentPage(1); }} 
          className={`cursor-pointer rounded-xl p-4 shadow-sm transition-all border-2 ${logFilter === "Wrong Number" ? "border-pink-500 bg-pink-50" : "border-transparent bg-white hover:bg-gray-50"}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <X className="h-5 w-5 text-pink-500" />
            <span className="text-xs font-bold uppercase text-gray-500">Wrong Number</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{wrongNumberCount}</p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="mb-6 p-4 bg-white rounded-xl shadow-sm border border-gray-200 space-y-3">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Search</label>
            <input
              type="text"
              placeholder="Search by name or phone..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full border rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Status</label>
            <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }} className="border rounded-md px-3 py-1.5 text-sm">
              <option value="All">All statuses</option>
              <option value="New">New</option>
              <option value="Contacted">Contacted</option>
              <option value="No_Answer">No Answer</option>
              <option value="Interested">Interested</option>
              <option value="Transferred">Transferred</option>
              <option value="Waiting">Waiting</option>
              <option value="Closed_Lost">Closed / Lost</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Type</label>
            <select value={filterClass} onChange={(e) => { setFilterClass(e.target.value); setCurrentPage(1); }} className="border rounded-md px-3 py-1.5 text-sm">
              <option value="All">All types</option>
              <option value="Hot">Hot</option>
              <option value="Warm">Warm</option>
              <option value="Cold">Cold</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> Date</label>
            <select value={filterDate} onChange={(e) => { setFilterDate(e.target.value); setCurrentPage(1); if (e.target.value !== "Custom") { setCustomFrom(""); setCustomTo(""); } }} className="border rounded-md px-3 py-1.5 text-sm">
              <option value="All">All time</option>
              <option value="Today">Today</option>
              <option value="Yesterday">Yesterday</option>
              <option value="This Week">This Week</option>
              <option value="This Month">This Month</option>
              <option value="Last 7 Days">Last 7 Days</option>
              <option value="Last 30 Days">Last 30 Days</option>
              <option value="Custom">Custom Range...</option>
            </select>
          </div>
          {filterDate === "Custom" && (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">From</label>
                <input type="date" value={customFrom} onChange={(e) => { setCustomFrom(e.target.value); setCurrentPage(1); }} className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">To</label>
                <input type="date" value={customTo} onChange={(e) => { setCustomTo(e.target.value); setCurrentPage(1); }} className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500" />
              </div>
            </>
          )}
          <div className="flex items-center gap-3 mt-4 w-full justify-between">
            <span className="text-sm text-gray-500">
              Showing <span className="font-bold text-gray-900">{filteredLeads.length}</span> leads
            </span>
            {/* Add Column Button (Manager only) */}
            {isManager && (
              showAddColumn ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newColumnName}
                    onChange={(e) => setNewColumnName(e.target.value)}
                    placeholder="Column name..."
                    className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-40"
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && handleAddColumn()}
                  />
                  <button onClick={handleAddColumn} disabled={addingColumn} className="p-1.5 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50">
                    <Check className="h-4 w-4" />
                  </button>
                  <button onClick={() => { setShowAddColumn(false); setNewColumnName(""); }} className="p-1.5 bg-gray-200 text-gray-600 rounded-md hover:bg-gray-300">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button onClick={() => setShowAddColumn(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-md hover:bg-blue-700 transition-colors shadow-sm">
                  <Plus className="h-3.5 w-3.5" /> Add Column
                </button>
              )
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone & Source</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status & Class</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sales Agent</th>
                {isManager && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Agent</th>}
                {/* Custom Columns */}
                {customColumns.map((col) => (
                  <th key={col.id} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    <div className="flex items-center gap-1.5">
                      <span>{col.name}</span>
                      {isManager && (
                        <button onClick={() => handleDeleteColumn(col.id)} className="text-gray-300 hover:text-red-500 transition-colors" title="Delete column">
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </th>
                ))}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedLeads.map((l) => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{l.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {l.phone}<br /><span className="text-xs text-gray-400">{l.source || "Unknown"}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 mb-1">{l.status}</span><br />
                    <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">{l.classification}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {l.salesAgent?.name ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                        {l.salesAgent.name}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </td>
                  {isManager && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <select
                        value={l.assignedTeleAgentId || ""}
                        onChange={(e) => handleReassignLead(l.id, e.target.value)}
                        className="border border-gray-300 rounded-md text-sm px-2 py-1 bg-white focus:ring-1 focus:ring-blue-500 max-w-[140px]"
                      >
                        <option value="">Unassigned</option>
                        {activeAgents.map(a => (
                          <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                      </select>
                    </td>
                  )}
                  {/* Custom Column Values */}
                  {customColumns.map((col) => {
                    const cellValue = getColumnValue(col.id, l.id);
                    const isEditing = editingCell?.columnId === col.id && editingCell?.leadId === l.id;
                    return (
                      <td key={col.id} className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="border border-blue-300 rounded px-2 py-1 text-xs w-24 focus:ring-1 focus:ring-blue-500"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveCellValue(col.id, l.id);
                                if (e.key === "Escape") { setEditingCell(null); setEditValue(""); }
                              }}
                            />
                            <button onClick={() => handleSaveCellValue(col.id, l.id)} className="text-green-600 hover:text-green-800">
                              <Check className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 group cursor-pointer" onClick={() => { setEditingCell({ columnId: col.id, leadId: l.id }); setEditValue(cellValue); }}>
                            <span className={cellValue ? "text-gray-700" : "text-gray-300 italic"}>{cellValue || "—"}</span>
                            <Pencil className="h-3 w-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center gap-2">
                      {l.status === "Transferred" || l.status === "In_Sales" ? (
                        <span className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-md text-xs font-bold">📅 Meeting Booked</span>
                      ) : l.status === "Closed_Won" ? (
                        <span className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-md text-xs font-bold">✓ Won</span>
                      ) : l.status === "Closed_Lost" ? (
                        <span className="px-3 py-1.5 bg-red-100 text-red-700 rounded-md text-xs font-bold">✗ Lost</span>
                      ) : userRole === "tele_sales_agent" ? (
                        <button
                          onClick={() => { setSelectedLead(l); setLogData({ callStatus: "Accept but lost", notes: "", meetingDate: "", meetingTime: "" }); }}
                          className="px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 rounded-md font-medium transition text-xs"
                        >
                          Log Call
                        </button>
                      ) : null}
                      {isManager && (
                        <button
                          onClick={() => handleDeleteLead(l.id)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                          title="Delete Lead"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredLeads.length === 0 && (
                <tr>
                  <td colSpan={isManager ? 5 + customColumns.length : 4 + customColumns.length} className="px-6 py-8 text-center text-sm text-gray-500 font-medium">
                    No leads currently available matching filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">Page {currentPage} of {totalPages}</span>
            <button 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {selectedLead && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">Log Call: {selectedLead.name}</h3>
              <button onClick={() => setSelectedLead(null)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            <form onSubmit={handleLogCall} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Call Status *</label>
                <select required className="w-full px-3 py-2 border rounded-md" value={logData.callStatus} onChange={(e) => setLogData({ ...logData, callStatus: e.target.value })}>
                  <option value="Busy">Busy</option>
                  <option value="Wrong Number">Wrong Number</option>
                  <option value="Accept but lost">Accept but lost</option>
                  <option value="Accept and book meeting">Accept and book meeting</option>
                </select>
              </div>
              {logData.callStatus === "Accept and book meeting" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Meeting Date *</label>
                    <input required type="date" className="w-full px-3 py-2 border rounded-md" value={logData.meetingDate} onChange={(e) => setLogData({ ...logData, meetingDate: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Meeting Time *</label>
                    <input required type="time" className="w-full px-3 py-2 border rounded-md" value={logData.meetingTime} onChange={(e) => setLogData({ ...logData, meetingTime: e.target.value })} />
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes *</label>
                <textarea required rows={3} className="w-full px-3 py-2 border rounded-md" value={logData.notes} onChange={(e) => setLogData({ ...logData, notes: e.target.value })} placeholder="Detailed call notes..." />
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setSelectedLead(null)} className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md">Cancel</button>
                <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">Save Call Log</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
