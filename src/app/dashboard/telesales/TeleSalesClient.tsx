"use client";
import { Fragment, useState, useEffect } from "react";
import { notify } from "@/components/toast";
import { todayInputValue, isPastMeetingDate } from "@/lib/meetingDate";
import { useRouter } from "next/navigation";
import { Plus, X, Pencil, Check, PhoneCall, CheckCircle2, PhoneOff, XCircle, Send, ChevronDown, ChevronUp, ExternalLink, Trash2, Video } from "lucide-react";
import { canManuallyDistributeMeeting } from "@/lib/meetingDistribution";
import { createCallLog } from "@/client/api/callLogs";
import { createCustomColumn, deleteCustomColumn, saveCustomColumnValue } from "@/client/api/customColumns";
import { deleteLead, distributeLeadMeeting, updateLead } from "@/client/api/leads";
import DateRangeFilter from "@/components/dashboard/DateRangeFilter";
import { isDateInRange } from "@/lib/dateRange";
import { formatDisplayDate, getLeadFollowUpDisplay, getLeadMeetingDisplay } from "@/lib/leadScheduleDisplay";
import MeetingLinksPanel from "@/components/MeetingLinksPanel";
import { useTranslator } from "@/components/i18n/LocaleProvider";

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
  const t = useTranslator();
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
  const [distributingLeadId, setDistributingLeadId] = useState<string | null>(null);

  // Reflect server data refreshed in the background (AutoRefresher / router.refresh)
  // so changes made elsewhere — new leads, distributed meetings — appear live
  // without a manual reload.
  useEffect(() => {
    setLeads(initialLeads);
  }, [initialLeads]);

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
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [logFilter, setLogFilter] = useState("All");
  const [expandedLeadId, setExpandedLeadId] = useState<string | null>(null);

  // Search & Pagination
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const isManager = userRole === "tele_sales_manager" || userRole === "super_admin";

  const handleDeleteLead = async (leadId: string) => {
    if (!confirm("Are you sure you want to delete this lead?")) return;
    try {
      await deleteLead(leadId);
      setLeads(leads.filter((l) => l.id !== leadId));
      router.refresh();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Network error");
    }
  };

  const handleReassignLead = async (leadId: string, newAgentId: string) => {
    try {
      await updateLead(leadId, { assignedTeleAgentId: newAgentId || null });
      const newlyAssignedAgent = activeAgents.find(a => a.id === newAgentId);
      setLeads(leads.map(l => l.id === leadId ? { ...l, assignedTeleAgentId: newAgentId, teleAgent: newlyAssignedAgent || null } : l));
      router.refresh();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Network err");
    }
  };

  const handleLogCall = async (e: React.FormEvent) => {
    e.preventDefault();

    // A meeting can never be booked for a past date.
    if (isPastMeetingDate(logData.meetingDate)) {
      notify("لا يمكن حجز اجتماع بتاريخ قديم. اختر اليوم أو تاريخ لاحق.", "error");
      return;
    }

    setLoading(true);

    try {
      const updatedLead = await createCallLog({
        leadId: selectedLead.id,
        classification: selectedLead.classification,
        ...logData,
      });

      // Update local state first with the full lead data (includes callLogs)
      setLeads(leads.map((l) => (l.id === (updatedLead as any).id ? updatedLead : l)));
      setSelectedLead(null);
      setLogData({ callStatus: "Accept but lost", notes: "", meetingDate: "", meetingTime: "" });
      // Then refresh server data in the background
      router.refresh();
    } catch (error) {
      notify(error instanceof Error ? `Error logging call: ${error.message}` : "Network error. Please try again.");
    }
    setLoading(false);
  };

  const handleDistributeMeeting = async (leadId: string) => {
    setDistributingLeadId(leadId);

    try {
      const data = await distributeLeadMeeting(leadId) as any;

      if (data.lead) {
        setLeads(leads.map((l) => (l.id === leadId ? data.lead : l)));
      }
      router.refresh();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Network error. Please try again.");
      router.refresh();
    } finally {
      setDistributingLeadId(null);
    }
  };

  // Custom Column handlers
  const handleAddColumn = async () => {
    if (!newColumnName.trim()) return;
    setAddingColumn(true);
    try {
      const col = await createCustomColumn({ name: newColumnName.trim() });
      setCustomColumns([...customColumns, col as CustomColumn]);
      setNewColumnName("");
      setShowAddColumn(false);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Network error");
    }
    setAddingColumn(false);
  };

  const handleDeleteColumn = async (colId: string) => {
    if (!confirm("Are you sure you want to delete this column?")) return;
    try {
      await deleteCustomColumn(colId);
      setCustomColumns(customColumns.filter((c) => c.id !== colId));
    } catch (error) {
      notify("Failed to delete column");
    }
  };

  const handleSaveCellValue = async (columnId: string, leadId: string) => {
    try {
      await saveCustomColumnValue({ columnId, leadId, value: editValue });
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
      notify("Failed to save value");
    }
    setEditingCell(null);
    setEditValue("");
  };

  const getColumnValue = (columnId: string, leadId: string): string => {
    const col = customColumns.find((c) => c.id === columnId);
    const val = col?.values.find((v) => v.leadId === leadId);
    return val?.value || "";
  };

  // Apply filters
  const filteredLeads = leads.filter((l) => {
    if (filterStatus !== "All" && l.status !== filterStatus) return false;
    if (filterClass !== "All" && l.classification !== filterClass) return false;

    if (!isDateInRange(l.createdAt, { from: fromDate, to: toDate })) return false;

    if (logFilter !== "All") {
      if (logFilter === "Accept and book meeting") {
        // Booked = a meeting was booked and the lead has NOT since fallen through
        // (a follow-up "Accept but lost" flips the status to Closed_Lost).
        const hasBookedMeeting =
          (!!l.meetingDate || ["Transferred", "In_Sales", "Closed_Won"].includes(l.status)) &&
          l.status !== "Closed_Lost";
        if (!hasBookedMeeting) return false;
      } else if (logFilter === "Actual Meetings") {
        // The meeting actually happened — the sales agent pressed Start Task.
        if (!l.meetingStartedAt) return false;
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
  // Booked = a meeting was booked and the lead has NOT since fallen through. A
  // later "Accept but lost" flips the status to Closed_Lost, which drops the
  // lead out of Booked (and into Accept but Lost) so the buckets stay consistent.
  const acceptBookCount = leads.filter(l =>
    (!!l.meetingDate || ["Transferred", "In_Sales", "Closed_Won"].includes(l.status)) &&
    l.status !== "Closed_Lost"
  ).length;
  // Actual Meetings = the sales agent the lead was sent to actually started the
  // booked meeting (Start Task sets meetingStartedAt).
  const actualMeetingsCount = leads.filter(l => !!l.meetingStartedAt).length;
  const busyCount = leads.filter(l => l.callLogs?.[0]?.callStatus === "Busy").length;
  const wrongNumberCount = leads.filter(l => l.callLogs?.[0]?.callStatus === "Wrong Number").length;

  return (
    <div className="space-y-6">
      <MeetingLinksPanel />

      {/* Workspace Summary Filters */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div 
          onClick={() => { setLogFilter(logFilter === "All" ? "All" : "All"); setCurrentPage(1); }} 
          className={`cursor-pointer rounded-xl p-4 shadow-sm transition-all border-2 ${logFilter === "All" ? "border-blue-500 bg-blue-50" : "border-transparent bg-white hover:bg-gray-50"}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <PhoneCall className="h-5 w-5 text-blue-500" />
            <span className="text-xs font-bold uppercase text-gray-500">{t("telesales.totalLeads")}</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{totalCount}</p>
        </div>

        <div 
          onClick={() => { setLogFilter(logFilter === "Accept and book meeting" ? "All" : "Accept and book meeting"); setCurrentPage(1); }} 
          className={`cursor-pointer rounded-xl p-4 shadow-sm transition-all border-2 ${logFilter === "Accept and book meeting" ? "border-green-500 bg-green-50" : "border-transparent bg-white hover:bg-gray-50"}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <span className="text-xs font-bold uppercase text-gray-500">{t("lead.call.acceptAndBook")}</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{acceptBookCount}</p>
        </div>

        <div
          onClick={() => { setLogFilter(logFilter === "Actual Meetings" ? "All" : "Actual Meetings"); setCurrentPage(1); }}
          className={`cursor-pointer rounded-xl p-4 shadow-sm transition-all border-2 ${logFilter === "Actual Meetings" ? "border-teal-500 bg-teal-50" : "border-transparent bg-white hover:bg-gray-50"}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <Video className="h-5 w-5 text-teal-500" />
            <span className="text-xs font-bold uppercase text-gray-500">{t("telesales.actualMeetings")}</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{actualMeetingsCount}</p>
        </div>

        <div
          onClick={() => { setLogFilter(logFilter === "Accept but lost" ? "All" : "Accept but lost"); setCurrentPage(1); }}
          className={`cursor-pointer rounded-xl p-4 shadow-sm transition-all border-2 ${logFilter === "Accept but lost" ? "border-orange-500 bg-orange-50" : "border-transparent bg-white hover:bg-gray-50"}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="h-5 w-5 text-orange-500" />
            <span className="text-xs font-bold uppercase text-gray-500">{t("lead.call.acceptButLost")}</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{acceptLostCount}</p>
        </div>

        <div 
          onClick={() => { setLogFilter(logFilter === "Busy" ? "All" : "Busy"); setCurrentPage(1); }} 
          className={`cursor-pointer rounded-xl p-4 shadow-sm transition-all border-2 ${logFilter === "Busy" ? "border-slate-500 bg-slate-50" : "border-transparent bg-white hover:bg-gray-50"}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <PhoneOff className="h-5 w-5 text-slate-500" />
            <span className="text-xs font-bold uppercase text-gray-500">{t("lead.call.busy")}</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{busyCount}</p>
        </div>

        <div 
          onClick={() => { setLogFilter(logFilter === "Wrong Number" ? "All" : "Wrong Number"); setCurrentPage(1); }} 
          className={`cursor-pointer rounded-xl p-4 shadow-sm transition-all border-2 ${logFilter === "Wrong Number" ? "border-pink-500 bg-pink-50" : "border-transparent bg-white hover:bg-gray-50"}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <X className="h-5 w-5 text-pink-500" />
            <span className="text-xs font-bold uppercase text-gray-500">{t("lead.call.wrongNumber")}</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{wrongNumberCount}</p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="mb-6 p-4 bg-white rounded-xl shadow-sm border border-gray-200 space-y-3">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">{t("common.search")}</label>
            <input
              type="text"
              placeholder={t("telesales.searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full border rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">{t("lead.status")}</label>
            <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }} className="border rounded-md px-3 py-1.5 text-sm">
              <option value="All">{t("telesales.allStatuses")}</option>
              <option value="New">{t("status.new")}</option>
              <option value="Contacted">{t("lead.status.contacted")}</option>
              <option value="No_Answer">{t("lead.call.noAnswer")}</option>
              <option value="Interested">{t("lead.status.interested")}</option>
              <option value="Transferred">{t("lead.status.transferred")}</option>
              <option value="Waiting">{t("lead.status.waiting")}</option>
              <option value="Closed_Lost">{t("lead.status.closedLost")}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">{t("lead.type")}</label>
            <select value={filterClass} onChange={(e) => { setFilterClass(e.target.value); setCurrentPage(1); }} className="border rounded-md px-3 py-1.5 text-sm">
              <option value="All">{t("telesales.allTypes")}</option>
              <option value="Hot">{t("lead.class.hot")}</option>
              <option value="Warm">{t("lead.class.warm")}</option>
              <option value="Cold">{t("lead.class.cold")}</option>
            </select>
          </div>
          <div className="w-full">
            <DateRangeFilter
              fromDate={fromDate}
              toDate={toDate}
              onFromDateChange={(value) => { setFromDate(value); setCurrentPage(1); }}
              onToDateChange={(value) => { setToDate(value); setCurrentPage(1); }}
              label="Created Date Range"
              description="Filters the lead list by creation date."
            />
          </div>
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
                    placeholder={t("telesales.columnNamePlaceholder")}
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
                <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase">{t("telesales.customer")}</th>
                <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase">{t("telesales.phoneAndSource")}</th>
                <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase">{t("telesales.statusAndClass")}</th>
                <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase">{t("telesales.meetingFollowUp")}</th>
                <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase">{t("telesales.salesAgent")}</th>
                {isManager && <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase">{t("telesales.agent")}</th>}
                {/* Custom Columns */}
                {customColumns.map((col) => (
                  <th key={col.id} className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase">
                    <div className="flex items-center gap-1.5">
                      <span>{col.name}</span>
                      {isManager && (
                        <button onClick={() => handleDeleteColumn(col.id)} className="text-gray-300 hover:text-red-500 transition-colors" title={t("telesales.deleteColumn")}>
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </th>
                ))}
                <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase">{t("telesales.action")}</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedLeads.map((l) => (
                <Fragment key={l.id}>
                <tr className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setExpandedLeadId(expandedLeadId === l.id ? null : l.id)}
                        className="p-1 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                        title={t("telesales.viewCustomer")}
                      >
                        {expandedLeadId === l.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                      <div>
                        <p>{l.name}</p>
                        {l.customerType && <p className="text-xs text-gray-400">{l.customerType}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {l.phone}<br /><span className="text-xs text-gray-400">{l.source || "Unknown"}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 mb-1">{l.status}</span><br />
                    <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">{l.classification}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {getLeadMeetingDisplay(l).hasDate ? (
                      <div>
                        <span className="font-semibold text-gray-800">{getLeadMeetingDisplay(l).dateLabel}</span>
                        {getLeadMeetingDisplay(l).timeLabel && <span className="text-blue-600 font-medium"> {getLeadMeetingDisplay(l).timeLabel}</span>}
                      </div>
                    ) : (
                      <span className="text-gray-400 text-xs">{t("telesales.noMeetingDate")}</span>
                    )}
                    {getLeadFollowUpDisplay(l).hasDate && (
                      <p className="text-xs text-amber-600 font-medium mt-1">Follow-up: {getLeadFollowUpDisplay(l).fullLabel}</p>
                    )}
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
                        <option value="">{t("telesales.unassigned")}</option>
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
                    <div className="flex flex-col items-start gap-1">
                      <div className="flex items-center gap-2">
                      {canManuallyDistributeMeeting(l) ? (
                        <button
                          onClick={() => handleDistributeMeeting(l.id)}
                          disabled={distributingLeadId === l.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-md text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 transition"
                          title={t("telesales.distributeMeeting")}
                        >
                          <Send className="h-3.5 w-3.5" />
                          {distributingLeadId === l.id ? "Distributing..." : "Distribute Meeting"}
                        </button>
                      ) : l.status === "Transferred" || l.status === "In_Sales" ? (
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
                          title={t("telesales.deleteLead")}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                      </div>
                      {getLeadMeetingDisplay(l).hasDate && (
                        <span className="text-xs text-gray-400">{getLeadMeetingDisplay(l).fullLabel}</span>
                      )}
                    </div>
                  </td>
                </tr>
                {expandedLeadId === l.id && (
                  <tr>
                    <td colSpan={isManager ? 7 + customColumns.length : 6 + customColumns.length} className="px-6 py-4 bg-slate-50">
                      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                          <h4 className="text-xs font-bold uppercase text-gray-500 mb-3">{t("telesales.customerDetails")}</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                            <p><span className="text-gray-400">Name:</span> <span className="font-medium text-gray-800">{l.name}</span></p>
                            <p><span className="text-gray-400">Phone:</span> <span className="font-medium text-gray-800">{l.phone}</span></p>
                            <p><span className="text-gray-400">Source:</span> <span className="font-medium text-gray-800">{l.source || "-"}</span></p>
                            <p><span className="text-gray-400">Niche:</span> <span className="font-medium text-gray-800">{l.niche || "-"}</span></p>
                            <p><span className="text-gray-400">Customer Type:</span> <span className="font-medium text-gray-800">{l.customerType || "-"}</span></p>
                            <p><span className="text-gray-400">Created:</span> <span className="font-medium text-gray-800">{formatDisplayDate(l.createdAt) || "-"}</span></p>
                            <p className="sm:col-span-2">
                              <span className="text-gray-400">Store:</span>{" "}
                              {l.storeLink ? (
                                <a href={l.storeLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline">
                                  Open store <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              ) : (
                                <span className="font-medium text-gray-800">-</span>
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                          <h4 className="text-xs font-bold uppercase text-gray-500 mb-3">{t("lead.schedule")}</h4>
                          <div className="space-y-2 text-sm">
                            <p><span className="text-gray-400">Meeting:</span> <span className="font-medium text-gray-800">{getLeadMeetingDisplay(l).fullLabel || "-"}</span></p>
                            <p><span className="text-gray-400">Follow-up:</span> <span className="font-medium text-gray-800">{getLeadFollowUpDisplay(l).fullLabel || "-"}</span></p>
                            <p><span className="text-gray-400">Sales Agent:</span> <span className="font-medium text-gray-800">{l.salesAgent?.name || "-"}</span></p>
                            <p><span className="text-gray-400">Tele Agent:</span> <span className="font-medium text-gray-800">{l.teleAgent?.name || "-"}</span></p>
                          </div>
                          <div className="mt-4 space-y-2">
                            <h5 className="text-xs font-bold uppercase text-gray-500">{t("telesales.meetingHistory")}</h5>
                            {l.meetings?.length ? l.meetings.map((meeting: any) => (
                              <div key={meeting.id} className="border border-purple-100 bg-purple-50 rounded-md p-2 text-xs">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-bold text-purple-700">{meeting.status}</span>
                                  <span className="text-gray-500">{formatDisplayDate(meeting.meetingDate)} {meeting.meetingTime || ""}</span>
                                </div>
                                {meeting.salesAgent?.name && <p className="text-purple-700 mt-1">Sales: {meeting.salesAgent.name}</p>}
                                {meeting.salesNotes && <p className="text-gray-600 mt-1">{meeting.salesNotes}</p>}
                              </div>
                            )) : <p className="text-xs text-gray-400">No meetings yet.</p>}
                          </div>
                        </div>

                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                          <h4 className="text-xs font-bold uppercase text-gray-500 mb-3">{t("telesales.callHistory")}</h4>
                          <div className="space-y-2 max-h-72 overflow-y-auto pe-1">
                            {l.callLogs?.length ? l.callLogs.map((log: any) => (
                              <div key={log.id} className="border border-gray-100 rounded-md p-2 text-xs">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-bold text-gray-800">{log.callStatus}</span>
                                  <span className="text-gray-400">{formatDisplayDate(log.createdAt)}</span>
                                  {log.agent?.name && <span className="text-blue-600">by {log.agent.name}</span>}
                                </div>
                                <p className="text-gray-600 mt-1">{log.notes}</p>
                              </div>
                            )) : <p className="text-xs text-gray-400">No call logs yet.</p>}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                </Fragment>
              ))}
              {filteredLeads.length === 0 && (
                <tr>
                  <td colSpan={isManager ? 7 + customColumns.length : 6 + customColumns.length} className="px-6 py-8 text-center text-sm text-gray-500 font-medium">
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
                  <option value="Busy">{t("lead.call.busy")}</option>
                  <option value="Wrong Number">{t("lead.call.wrongNumber")}</option>
                  <option value="Accept but lost">{t("lead.call.acceptButLost")}</option>
                  <option value="Accept and book meeting">{t("lead.call.acceptAndBookLong")}</option>
                </select>
              </div>
              {logData.callStatus === "Accept and book meeting" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Meeting Date *</label>
                    <input required type="date" min={todayInputValue()} className="w-full px-3 py-2 border rounded-md" value={logData.meetingDate} onChange={(e) => setLogData({ ...logData, meetingDate: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Meeting Time *</label>
                    <input required type="time" className="w-full px-3 py-2 border rounded-md" value={logData.meetingTime} onChange={(e) => setLogData({ ...logData, meetingTime: e.target.value })} />
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes *</label>
                <textarea required rows={3} className="w-full px-3 py-2 border rounded-md" value={logData.notes} onChange={(e) => setLogData({ ...logData, notes: e.target.value })} placeholder={t("telesales.callNotesPlaceholder")} />
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setSelectedLead(null)} className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md">{t("common.cancel")}</button>
                <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">{t("telesales.saveCallLog")}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
