"use client";

import React, { useState, useEffect, useRef } from "react";
import { notify } from "@/components/toast";
import { todayInputValue, isPastMeetingDate } from "@/lib/meetingDate";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Calendar, PhoneCall, ChevronDown, ChevronUp, CheckCircle2, XCircle, FileText, Send, X, Clock, AlertTriangle, ExternalLink } from "lucide-react";
import CreateWarningModal from "@/components/CreateWarningModal";
import { createDeal } from "@/client/api/deals";
import { updateLead } from "@/client/api/leads";
import { sendNotification } from "@/client/api/notifications";
import { HttpError } from "@/client/transport/http";
import { updateUserStatus } from "@/client/api/users";
import DateRangeFilter from "@/components/dashboard/DateRangeFilter";
import { isDateInRange } from "@/lib/dateRange";
import { getLeadFollowUpDisplay, getLeadMeetingDisplay } from "@/lib/leadScheduleDisplay";
import { PACKAGE_SERVICES, buildDealPackageLabel } from "@/lib/dealPackage";

export default function SalesClient({ initialLeads, userRole, userId, initialStatus, postSaleProjects = [] }: { initialLeads: any[], userRole: string, userId: string, initialStatus: string, postSaleProjects?: any[] }) {
  const router = useRouter();
  const [leads, setLeads] = useState(initialLeads);
  const [status, setStatus] = useState(initialStatus);
  const [activeLead, setActiveLead] = useState<any>(null);
  const [expandedLead, setExpandedLead] = useState<string | null>(null);
  const [logFilter, setLogFilter] = useState("All");
  const [activeTab, setActiveTab] = useState("leads"); // "leads" or "post-sale"
  const [warningProject, setWarningProject] = useState<any>(null);

  // Reflect server data refreshed in the background (AutoRefresher / router.refresh)
  // so newly distributed meetings appear in the agent's queue without a reload.
  useEffect(() => {
    setLeads(initialLeads);
  }, [initialLeads]);

  // Search, Pagination, & Dates
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;
  
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Task timer
  const [taskStartTime, setTaskStartTime] = useState<Date | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Live In-Call Timer
  useEffect(() => {
    if (activeLead && taskStartTime) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - taskStartTime.getTime()) / 1000));
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [activeLead, taskStartTime]);

  // Restore active task on mount: if the agent's saved status is In_Call, find the
  // lead they were working on (meetingStartedAt set, meetingEndedAt null) and rehydrate
  // local state so the End Task button — not Start Task — appears.
  // If no truly-in-progress lead exists (orphan In_Call state from an abandoned feedback
  // form or pre-fix data), self-heal by resetting the agent status to Active so the
  // workspace isn't permanently locked.
  useEffect(() => {
    if (activeLead || initialStatus !== "In_Call") return;
    const inProgress = initialLeads.find(
      (l: any) => l.meetingStartedAt && !l.meetingEndedAt
    );
    if (inProgress) {
      setActiveLead(inProgress);
      setTaskStartTime(new Date(inProgress.meetingStartedAt));
      setFeedback(prev => ({
        ...prev,
        hasStore: inProgress.hasStore ? "Yes" : "No",
        storeLink: inProgress.storeLink || "",
        customerType: inProgress.customerType || "Launch",
      }));
    } else {
      setStatus("Active");
      updateUserStatus(userId, { status: "Active" }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Last Activity Tracking
  const [lastActivityTime, setLastActivityTime] = useState<Date | null>(new Date());
  const [lastActivityText, setLastActivityText] = useState("");

  useEffect(() => {
    const updateText = () => {
      if (!lastActivityTime) { setLastActivityText(""); return; }
      const diff = Math.floor((Date.now() - lastActivityTime.getTime()) / 1000);
      if (diff < 60) setLastActivityText("Just now");
      else if (diff < 3600) setLastActivityText(`${Math.floor(diff / 60)} min ago`);
      else setLastActivityText(`${Math.floor(diff / 3600)}h ago`);
    };
    updateText();
    const interval = setInterval(updateText, 30000);
    return () => clearInterval(interval);
  }, [lastActivityTime]);
  
  // Deal closing form
  const [showClosingForm, setShowClosingForm] = useState(false);
  const [dealData, setDealData] = useState({
    packageMode: "unified" as "unified" | "monthly",
    packageServices: [] as string[],
    monthlyPackages: [{ services: [] as string[] }],
    contractStart: "",
    contractEnd: "",
    totalAmount: "",
    firstAmount: "",
    paymentType: "Full",
    paymentMethod: "Cash",
    installments: [] as any[],
    contractImageUrl: "",
    receiptUrl: ""
  });

  // Feedback form
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [feedbackDraft, setFeedbackDraft] = useState(false); // tracks if there's unsaved feedback
  const [feedback, setFeedback] = useState({
    notes: "",
    outcome: "won", // "won", "lost", "followup", "reschedule"
    followUpDate: "",
    meetingDate: "",
    meetingTime: "",
    hasStore: "No", // "Yes" or "No"
    storeLink: "",
    customerType: "Launch" // Store, Launch, Dropshipping, Shipping, Special
  });

  // Warn user before leaving page with unsaved feedback
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (activeLead && feedbackDraft) {
        e.preventDefault();
        e.returnValue = "You must complete the feedback before closing the call.";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [activeLead, feedbackDraft]);

  // Send Link State
  const [linkLead, setLinkLead] = useState<any>(null);
  const [meetingLink, setMeetingLink] = useState("");
  const [sendingLink, setSendingLink] = useState(false);

  const toggleStatus = async () => {
    if (status === "In_Call" || feedbackDraft) return;
    const newStatus = status === "Active" ? "Busy" : "Active";
    setStatus(newStatus);
    setLastActivityTime(new Date());
    await updateUserStatus(userId, { status: newStatus });
  };

  const startTask = async (lead: any) => {
    const startedAt = new Date();
    setStatus("In_Call");
    setActiveLead({ ...lead, meetingStartedAt: startedAt, meetingEndedAt: null });
    setTaskStartTime(startedAt);

    // Pre-fill existing profile data (Store, Client Type) so they don't disappear on subsequent follow-ups
    setFeedback(prev => ({
      ...prev,
      hasStore: lead.hasStore ? "Yes" : "No",
      storeLink: lead.storeLink || "",
      customerType: lead.customerType || "Launch",
    }));

    // Persist start time on the lead so the active task survives a page reload
    // (the mount-effect uses meetingStartedAt/meetingEndedAt to rehydrate).
    setLeads(prev => prev.map(l =>
      l.id === lead.id ? { ...l, meetingStartedAt: startedAt, meetingEndedAt: null } : l
    ));
    await updateLead(lead.id, { meetingStartedAt: startedAt, meetingEndedAt: null });

    await updateUserStatus(userId, { status: "In_Call" });
  };

  const endTask = () => {
    setShowFeedbackForm(true);
    setFeedbackDraft(true);
  };

  const closeFeedbackTemporarily = () => {
    // Close modal but keep draft data — user can reopen
    setShowFeedbackForm(false);
  };

  const submitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();

    // Rescheduling can never move a meeting to a past date.
    if (feedback.outcome === "reschedule" && isPastMeetingDate(feedback.meetingDate)) {
      notify("لا يمكن إعادة جدولة الاجتماع بتاريخ قديم. اختر اليوم أو تاريخ لاحق.", "error");
      return;
    }

    const payloadStartEnd = {
      meetingStartedAt: taskStartTime,
      meetingEndedAt: new Date(),
      hasStore: feedback.hasStore === "Yes",
      storeLink: feedback.storeLink,
      customerType: feedback.customerType
    };

    if (feedback.outcome === "won") {
      // For won deal, update the lead with the store details & timer first.
      await updateLead(activeLead.id, { ...payloadStartEnd, notes: feedback.notes });
      setShowFeedbackForm(false);
      setShowClosingForm(true);
    } else {
      let finalStatus = "Closed_Lost";
      let extraData: any = {};
      
      if (feedback.outcome === "followup") {
        finalStatus = "Follow_Up";
        extraData = { followUpDate: feedback.followUpDate };
      } else if (feedback.outcome === "reschedule") {
        finalStatus = "Rescheduled";
        extraData = { meetingDate: feedback.meetingDate, meetingTime: feedback.meetingTime };
      }

      await updateLead(activeLead.id, { 
        status: finalStatus, 
        notes: feedback.notes,
        ...payloadStartEnd,
        ...extraData
      });
      
      await updateUserStatus(userId, { status: "Active" });
      
      setStatus("Active");
      setShowFeedbackForm(false);
      setFeedbackDraft(false);
      setLeads(prev => prev.map(l => l.id === activeLead.id ? { ...l, status: finalStatus, ...extraData } : l));
      setActiveLead(null);
      // Reset feedback for next task
      setFeedback({ notes: "", outcome: "won", followUpDate: "", meetingDate: "", meetingTime: "", hasStore: "No", storeLink: "", customerType: "Launch" });
      router.refresh();
    }
  };

  const addInstallment = () => {
    setDealData({
      ...dealData,
      installments: [...dealData.installments, { date: "", amount: "" }]
    });
  };

  const updateInstallment = (index: number, field: string, value: string) => {
    const newInsts = dealData.installments.map((inst, i) => i === index ? { ...inst, [field]: value } : inst);
    setDealData({ ...dealData, installments: newInsts });
  };

  const toggleService = (services: string[], svc: string) =>
    services.includes(svc) ? services.filter(s => s !== svc) : [...services, svc];

  const toggleUnifiedService = (svc: string) => {
    setDealData(prev => ({ ...prev, packageServices: toggleService(prev.packageServices, svc) }));
  };

  const toggleMonthlyService = (monthIdx: number, svc: string) => {
    setDealData(prev => ({
      ...prev,
      monthlyPackages: prev.monthlyPackages.map((m, i) =>
        i === monthIdx ? { services: toggleService(m.services, svc) } : m
      ),
    }));
  };

  const addPackageMonth = () => {
    setDealData(prev => ({ ...prev, monthlyPackages: [...prev.monthlyPackages, { services: [] }] }));
  };

  const removePackageMonth = (monthIdx: number) => {
    setDealData(prev => ({ ...prev, monthlyPackages: prev.monthlyPackages.filter((_, i) => i !== monthIdx) }));
  };

  const closeDeal = async (e: React.FormEvent) => {
    e.preventDefault();

    const packageType = buildDealPackageLabel(dealData);
    if (!packageType) {
      notify(
        dealData.packageMode === "monthly"
          ? "Select at least one package service for every month."
          : "Select at least one package service."
      );
      return;
    }

    const payload = { ...dealData, packageType };
    // Default firstAmount to totalAmount if not provided
    if (!payload.firstAmount) {
      payload.firstAmount = payload.totalAmount;
    }
    if (payload.paymentType === "Full") {
      payload.installments = [];
    }

    try {
      await createDeal({
          leadId: activeLead.id,
          ...payload
      });
    } catch (error) {
      notify(`Failed to close deal: ${error instanceof Error ? error.message : "Unknown error"}`);
      return;
    }
    // The Operations project is created atomically by POST /api/deals — no
    // separate setup call is needed, so the deal can never be left without one.
    
    await updateUserStatus(userId, { status: "Active" });
    setStatus("Active");
    setShowClosingForm(false);
    setFeedbackDraft(false);
    // Update lead local state to Closed_Won so UI reflects immediately
    setLeads(prev => prev.map(l => l.id === activeLead.id ? { ...l, status: "Closed_Won" } : l));
    setActiveLead(null);
    setFeedback({ notes: "", outcome: "won", followUpDate: "", meetingDate: "", meetingTime: "", hasStore: "No", storeLink: "", customerType: "Launch" });
    setDealData({
      packageMode: "unified", packageServices: [], monthlyPackages: [{ services: [] }],
      contractStart: "", contractEnd: "",
      totalAmount: "", firstAmount: "", paymentType: "Full",
      paymentMethod: "Cash", installments: [], contractImageUrl: "", receiptUrl: ""
    });
    router.refresh();
  };

  const submitLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!meetingLink || !linkLead?.teleAgent?.id) return;

    setSendingLink(true);
    try {
      await sendNotification({
        userId: linkLead.teleAgent.id,
        leadId: linkLead.id,
        title: "Meeting Link Added",
        message: `Sales Agent added meeting link for lead ${linkLead.name}: ${meetingLink}`,
        link: meetingLink,
        type: "meeting_link",
        relatedId: linkLead.id,
      });
      notify("Link sent to TeleSales Agent!");
      setLinkLead(null);
      setMeetingLink("");
    } catch (error) {
      const message = error instanceof HttpError ? error.message : "Failed to send link";
      notify(message);
    } finally {
      setSendingLink(false);
    }
  };

  const classColor = (cls: string) => {
    if (cls === "Hot") return "bg-red-100 text-red-700";
    if (cls === "Warm") return "bg-amber-100 text-amber-700";
    return "bg-blue-100 text-blue-700";
  };

  // Apply Date Filter FIRST to recalculate all stats accurately
  const timeFilteredLeads = leads.filter(l => {
    const scheduleDate =
      l.status === "Follow_Up"
        ? l.followUpDate
        : l.meetings?.[0]?.meetingDate ?? l.meetingDate;

    return isDateInRange(scheduleDate, { from: fromDate, to: toDate });
  });

  // KPI counts — Total Meets is the universe (all meetings in the period),
  // not just active leads, so Total Meets >= Win Deal + Closed Lost.
  const totalMeets = timeFilteredLeads.length;
  const closedWon = timeFilteredLeads.filter(l => l.status === "Closed_Won" || l._count?.deals > 0).length;
  const followUp = timeFilteredLeads.filter(l => l.status === "Follow_Up").length;
  const rescheduled = timeFilteredLeads.filter(l => l.status === "Rescheduled").length;
  const closedLost = timeFilteredLeads.filter(l => l.status === "Closed_Lost").length;

  const filteredLeads = timeFilteredLeads.filter(l => {
    if (logFilter === "All") {
      return !["Closed_Won", "Closed_Lost"].includes(l.status);
    } else if (logFilter === "Closed_Won") {
      if (l.status !== "Closed_Won" && !(l._count?.deals > 0)) return false;
    } else {
      if (l.status !== logFilter) return false;
    }
    
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!l.name.toLowerCase().includes(q) && !l.phone.includes(q)) return false;
    }
    
    return true;
  });

  const totalPages = Math.ceil(filteredLeads.length / pageSize) || 1;
  const paginatedLeads = filteredLeads.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div>
      <div className="flex gap-4 mb-4 border-b border-gray-200">
        <button 
          onClick={() => setActiveTab("leads")}
          className={`pb-2 px-4 font-bold text-sm transition-colors border-b-2 ${activeTab === "leads" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          Active Leads Workspace
        </button>
        <button 
          onClick={() => setActiveTab("post-sale")}
          className={`pb-2 px-4 font-bold text-sm transition-colors border-b-2 ${activeTab === "post-sale" ? "border-emerald-600 text-emerald-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          Post-Sale Journey ({postSaleProjects.length})
        </button>
      </div>

      <div className="mb-6 flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase">My Status</h2>
          <div className="flex items-center mt-2 gap-3">
            <div className="flex items-center">
              <span className="relative flex h-3 w-3 mr-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${status === "Active" ? "bg-green-400" : status === "In_Call" ? "bg-red-400" : "bg-yellow-400"}`}></span>
                <span className={`relative inline-flex rounded-full h-3 w-3 ${status === "Active" ? "bg-green-500" : status === "In_Call" ? "bg-red-500" : "bg-yellow-500"}`}></span>
              </span>
              <span className="font-bold text-gray-900">{status.replace("_", " ")}</span>
            </div>
            
            {/* In-Call Timer */}
            {status === "In_Call" && activeLead && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200 animate-pulse">
                <Clock className="h-3.5 w-3.5" />
                {formatTimer(elapsedSeconds)}
              </span>
            )}

            {/* Last Activity */}
            {status !== "In_Call" && lastActivityText && (
              <span className="text-xs text-gray-400 font-medium">
                Last Activity: {lastActivityText}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={toggleStatus}
          disabled={status === "In_Call" || feedbackDraft}
          className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
          title={feedbackDraft ? "Complete feedback before toggling status" : ""}
        >
          Toggle Status
        </button>
      </div>

      {activeTab === "leads" ? (
        <>
          {/* Workspace Summary Filters */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div 
          onClick={() => setLogFilter("All")} 
          className={`cursor-pointer rounded-xl p-4 shadow-sm transition-all border-2 ${logFilter === "All" ? "border-blue-500 bg-blue-50" : "border-transparent bg-white hover:bg-gray-50"}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <PhoneCall className="h-5 w-5 text-blue-500" />
            <span className="text-xs font-bold uppercase text-gray-500">Total Meets</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{totalMeets}</p>
        </div>

        <div 
          onClick={() => setLogFilter("Closed_Won")} 
          className={`cursor-pointer rounded-xl p-4 shadow-sm transition-all border-2 ${logFilter === "Closed_Won" ? "border-green-500 bg-green-50" : "border-transparent bg-white hover:bg-gray-50"}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <span className="text-xs font-bold uppercase text-gray-500">Win Deal</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{closedWon}</p>
        </div>

        <div 
          onClick={() => setLogFilter("Follow_Up")} 
          className={`cursor-pointer rounded-xl p-4 shadow-sm transition-all border-2 ${logFilter === "Follow_Up" ? "border-amber-500 bg-amber-50" : "border-transparent bg-white hover:bg-gray-50"}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <ChevronUp className="h-5 w-5 text-amber-500" />
            <span className="text-xs font-bold uppercase text-gray-500">Follow-up</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{followUp}</p>
        </div>

        <div 
          onClick={() => setLogFilter("Rescheduled")} 
          className={`cursor-pointer rounded-xl p-4 shadow-sm transition-all border-2 ${logFilter === "Rescheduled" ? "border-purple-500 bg-purple-50" : "border-transparent bg-white hover:bg-gray-50"}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <PhoneCall className="h-5 w-5 text-purple-500" />
            <span className="text-xs font-bold uppercase text-gray-500">Reschedule</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{leads.filter(l => l.status === "Rescheduled").length}</p>
        </div>

        <div 
          onClick={() => setLogFilter("Closed_Lost")} 
          className={`cursor-pointer rounded-xl p-4 shadow-sm transition-all border-2 ${logFilter === "Closed_Lost" ? "border-red-500 bg-red-50" : "border-transparent bg-white hover:bg-gray-50"}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="h-5 w-5 text-red-500" />
            <span className="text-xs font-bold uppercase text-gray-500">Lost Deal</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{leads.filter(l => l.status === "Closed_Lost").length}</p>
        </div>
      </div>

      {/* Search Input & Date Filters */}
      <div className="mb-4 flex flex-col xl:flex-row items-stretch xl:items-start gap-4">
        <div className="flex-1 w-full max-w-sm">
          <input
            type="text"
            placeholder="Search leads by name or phone..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="w-full border rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex-[2] min-w-[280px]">
          <DateRangeFilter
            fromDate={fromDate}
            toDate={toDate}
            onFromDateChange={(value) => { setFromDate(value); setCurrentPage(1); }}
            onToDateChange={(value) => { setToDate(value); setCurrentPage(1); }}
            label="Schedule Date Range"
            description="Filters by meeting date, or follow-up date for follow-up clients."
          />
        </div>

        <div className="text-sm font-bold text-gray-700 bg-gray-100 px-4 py-2 rounded-full whitespace-nowrap">
          {filteredLeads.length} Leads
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lead</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone & Source</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Classification</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">TeleSales Agent</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Meeting Time</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Follow-up</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Note</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedLeads.map((l) => (
              <React.Fragment key={l.id}>
                <tr className={`${activeLead?.id === l.id ? 'bg-blue-50' : 'hover:bg-gray-50'} transition-colors`}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <p className="text-sm font-medium text-gray-900">{l.name}</p>
                    {l.customerType && <p className="text-xs text-gray-400">{l.customerType}</p>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <p className="text-sm text-gray-700 font-medium">{l.phone}</p>
                    <p className="text-xs text-gray-400">{l.source || "Unknown"}</p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${classColor(l.classification)}`}>{l.classification}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      {l.teleAgent?.name || <span className="text-gray-400 italic">—</span>}
                      {l.teleAgent && (
                        <button 
                          onClick={() => setLinkLead(l)}
                          title="Send Meeting Link"
                          className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-md transition-colors"
                        >
                          <Send className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {(() => {
                      const meetingDisplay = getLeadMeetingDisplay(l);
                      if (!meetingDisplay.hasDate) {
                        return <span className="text-gray-400 italic">—</span>;
                      }
                      return (
                        <>
                          <span className="font-medium text-gray-800">{meetingDisplay.dateLabel}</span>
                          {meetingDisplay.timeLabel && (
                            <span className="text-blue-600 font-medium"> {meetingDisplay.timeLabel}</span>
                          )}
                        </>
                      );
                    })()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {(() => {
                      const followUpDisplay = getLeadFollowUpDisplay(l);
                      if (!followUpDisplay.hasDate) {
                        return <span className="text-gray-400 italic">—</span>;
                      }
                      return (
                        <>
                          <span className="font-semibold text-amber-700">Follow-up</span>
                          <br />
                          <span className="text-xs text-amber-600 font-medium">{followUpDisplay.fullLabel}</span>
                        </>
                      );
                    })()}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 max-w-xs">
                    <div className="flex items-center gap-2">
                      <span className="truncate max-w-[180px]">{l.callLogs?.[0]?.notes || <span className="text-gray-400 italic">No notes</span>}</span>
                      {l.callLogs && l.callLogs.length > 0 && (
                        <button
                          onClick={() => setExpandedLead(expandedLead === l.id ? null : l.id)}
                          className="text-blue-500 hover:text-blue-700 shrink-0"
                          title="View all call logs"
                        >
                          {expandedLead === l.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                    {l.status === "Closed_Won" ? (
                      <span className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-md text-xs font-bold">✓ Won</span>
                    ) : l.status === "Closed_Lost" ? (
                      <span className="px-3 py-1.5 bg-red-100 text-red-700 rounded-md text-xs font-bold">✗ Lost</span>
                    ) : activeLead?.id === l.id ? (
                      <button onClick={endTask} className="px-3 py-1.5 bg-red-600 text-white rounded-md text-xs font-medium hover:bg-red-700">End Task</button>
                    ) : (
                      <button onClick={() => startTask(l)} disabled={!!activeLead} className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-xs font-medium hover:bg-blue-700 disabled:opacity-50">Start Task</button>
                    )}
                  </td>
                </tr>
                {/* Expanded Call Logs */}
                {expandedLead === l.id && l.callLogs && l.callLogs.length > 0 && (
                  <tr key={`${l.id}-logs`}>
                    <td colSpan={8} className="px-6 py-3 bg-slate-50">
                      <div className="space-y-2">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">TeleSales Call History ({l.callLogs.length} calls)</p>
                        {l.callLogs.map((log: any, idx: number) => (
                          <div key={log.id || idx} className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-100 text-sm">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                                  log.callStatus === "Accept and book meeting" ? "bg-green-100 text-green-700" :
                                  log.callStatus === "Accept but lost" ? "bg-orange-100 text-orange-700" :
                                  log.callStatus === "Busy" ? "bg-yellow-100 text-yellow-700" :
                                  "bg-gray-100 text-gray-600"
                                }`}>{log.callStatus}</span>
                                {log.agent?.name && <span className="text-xs text-gray-400">by {log.agent.name}</span>}
                              </div>
                              <p className="text-xs text-gray-600 mt-1">{log.notes}</p>
                            </div>
                            <span className="text-xs text-gray-400 whitespace-nowrap">{new Date(log.createdAt).toLocaleDateString("en-GB")}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            {paginatedLeads.length === 0 && (
              <tr><td colSpan={8} className="px-6 py-8 text-center text-sm text-gray-500">No active leads match the filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      
      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <button 
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm font-medium text-gray-600">Page {currentPage} of {totalPages}</span>
          <button 
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
      </>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-emerald-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-emerald-700 uppercase tracking-wider">Client (Project)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-emerald-700 uppercase tracking-wider">Account Manager</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-emerald-700 uppercase tracking-wider">Current Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-emerald-700 uppercase tracking-wider">Progress</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-emerald-700 uppercase tracking-wider">Active Warnings</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-emerald-700 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {postSaleProjects.map(project => {
                const totalProgress = Math.round(((project.seoProgress || 0) + (project.socialMediaProgress || 0) + (project.mediaBuyerProgress || 0)) / 3);
                return (
                  <tr key={project.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-gray-900">{project.deal?.lead?.name}</div>
                      <div className="text-xs text-gray-500">{project.package} Package</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {project.accountManager?.name || <span className="text-gray-400 italic">Unassigned</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-bold uppercase border">
                        {project.projectStatus.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div className={`h-2 rounded-full ${totalProgress > 70 ? 'bg-emerald-500' : totalProgress > 30 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${totalProgress}%` }}></div>
                        </div>
                        <span className="text-xs font-bold text-gray-700">{totalProgress}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {project.warnings && project.warnings.length > 0 ? (
                        <span className="inline-flex items-center justify-center px-2 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-bold">
                          {project.warnings.length} Unresolved
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">None</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/dashboard/clients/${project.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-md text-xs font-bold transition"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Journey
                        </Link>
                        <button
                          onClick={() => setWarningProject(project)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-md text-xs font-bold transition"
                        >
                          <AlertTriangle className="h-3 w-3" />
                          Warning
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {postSaleProjects.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">
                    No closed deals have transitioned to projects yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Warning Modal for Post-Sale Projects */}
      {warningProject && (
        <CreateWarningModal
          isOpen={true}
          projectId={warningProject.id}
          onClose={() => { setWarningProject(null); router.refresh(); }}
        />
      )}

      {showFeedbackForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3 sm:p-4">
          <form onSubmit={submitFeedback} className="bg-white rounded-xl shadow-xl w-full max-w-sm sm:max-w-md max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center px-4 sm:px-5 py-3 border-b shrink-0">
              <h3 className="text-base font-bold">Task Feedback</h3>
              <button
                type="button"
                onClick={closeFeedbackTemporarily}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                title="Close temporarily — your data will be saved as draft"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto px-4 sm:px-5 py-4 space-y-4">

            {activeLead?.callLogs?.[0] && (() => {
              const lastLog = activeLead.callLogs[0];
              const diffTime = Math.abs(new Date().getTime() - new Date(lastLog.createdAt).getTime());
              const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
              const isLate = diffDays > 3;

              return (
                <div className={`mb-4 border rounded-lg p-3 shadow-sm ${isLate ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`}>
                  <div className="flex justify-between items-center mb-1">
                    <h4 className={`text-sm font-bold flex items-center gap-1 ${isLate ? 'text-red-800' : 'text-blue-800'}`}>
                      {isLate ? '⚠️ Late Follow-up' : '💡 Last Note & Profile'}
                    </h4>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isLate ? 'text-red-700 bg-red-100' : 'text-blue-700 bg-blue-100'}`}>
                      Last contact: {diffDays === 0 ? "today" : `${diffDays} days ago`}
                    </span>
                  </div>
                  
                  {activeLead.hasStore && activeLead.storeLink && (
                    <div className="mt-3 mb-2 flex items-center gap-3 bg-white/80 p-2 rounded border border-white">
                       <span className="text-xs font-bold text-gray-800">
                         🏪 {activeLead.customerType || 'Store'}
                       </span>
                       <a href={activeLead.storeLink} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:text-blue-800 hover:underline break-all font-medium">
                         {activeLead.storeLink}
                       </a>
                    </div>
                  )}

                  <p className="text-sm text-gray-700 italic bg-white/50 p-2 rounded border border-white mt-2">"{lastLog.notes}"</p>
                  <p className="text-[10px] text-gray-500 mt-2 text-right font-medium">- {lastLog.agent?.name} ({new Date(lastLog.createdAt).toLocaleString("en-GB")})</p>
                </div>
              );
            })()}

            {activeLead?.callLogs?.length > 1 && (
              <div className="mb-4">
                <h4 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2"><FileText className="h-4 w-4 text-gray-500" /> Interaction History</h4>
                <div className="max-h-40 overflow-y-auto space-y-2 pr-2 border border-gray-100 rounded-lg p-2 bg-gray-50/50">
                  {activeLead.callLogs.slice(1).map((log: any) => (
                    <div key={log.id} className="bg-white border border-gray-200 rounded p-2 shadow-sm relative">
                       <div className="flex justify-between items-center mb-1">
                         <span className="text-xs font-semibold text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">{log.callStatus}</span>
                         <span className="text-[10px] text-gray-400">{new Date(log.createdAt).toLocaleString("en-GB")}</span>
                       </div>
                       <p className="text-xs text-gray-600 mt-1.5">{log.notes}</p>
                       <p className="text-[10px] text-gray-400 mt-1.5 text-right">- {log.agent?.name}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-4 border-t pt-4">
              <div>
                <label className="block text-sm font-medium mb-1">Outcome</label>
                <div className="flex gap-4 flex-wrap">
                  <label className="flex items-center gap-2">
                    <input type="radio" checked={feedback.outcome === "won"} onChange={() => setFeedback({...feedback, outcome: "won"})} /> Won! Deal Closing
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" checked={feedback.outcome === "lost"} onChange={() => setFeedback({...feedback, outcome: "lost"})} /> Lost / No Deal
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" checked={feedback.outcome === "followup"} onChange={() => setFeedback({...feedback, outcome: "followup"})} /> Follow-up
                  </label>
                  <label className="flex items-center gap-2 text-blue-600 font-medium">
                    <input type="radio" checked={feedback.outcome === "reschedule"} onChange={() => setFeedback({...feedback, outcome: "reschedule"})} /> Reschedule
                  </label>
                </div>
              </div>
              {feedback.outcome === "followup" && (
                <div>
                  <label className="block text-sm font-medium mb-1">Follow-up Date</label>
                  <input required type="date" className="w-full border p-2 rounded" value={feedback.followUpDate} onChange={e => setFeedback({...feedback, followUpDate: e.target.value})} />
                </div>
              )}
              {feedback.outcome === "reschedule" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-blue-700">New Meeting Date</label>
                    <input required type="date" min={todayInputValue()} className="w-full border p-2 rounded focus:ring-blue-500" value={feedback.meetingDate} onChange={e => setFeedback({...feedback, meetingDate: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-blue-700">New Meeting Time</label>
                    <input required type="time" className="w-full border p-2 rounded focus:ring-blue-500" value={feedback.meetingTime} onChange={e => setFeedback({...feedback, meetingTime: e.target.value})} />
                  </div>
                </div>
              )}
              
              {/* Additional Information - Client Profile */}
              <div className="border-t pt-4">
                <h4 className="font-bold text-sm text-gray-800 mb-3">Client Profile</h4>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Has Store?</label>
                    <select className="w-full border p-2 rounded focus:ring-blue-500" value={feedback.hasStore} onChange={e => setFeedback({...feedback, hasStore: e.target.value})}>
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Client Type</label>
                    <select className="w-full border p-2 rounded focus:ring-blue-500" value={feedback.customerType} onChange={e => setFeedback({...feedback, customerType: e.target.value})}>
                      <option value="Store">Store</option>
                      <option value="Launch">Launch / Beginning</option>
                      <option value="Dropshipping">Dropshipping</option>
                      <option value="Shipping">Shipping</option>
                      <option value="Special">Special Type</option>
                    </select>
                  </div>
                </div>
                {feedback.hasStore === "Yes" && (
                  <div className="mb-3">
                    <label className="block text-sm font-medium mb-1">Store Link</label>
                    <input type="url" placeholder="https://..." className="w-full border p-2 rounded focus:ring-blue-500" value={feedback.storeLink} onChange={e => setFeedback({...feedback, storeLink: e.target.value})} required={feedback.hasStore === "Yes"} />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-bold text-blue-800 mb-1">New Meeting Notes *</label>
                <textarea required rows={3} className="w-full border-2 border-blue-200 p-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-gray-400" value={feedback.notes} onChange={e => setFeedback({...feedback, notes: e.target.value})} placeholder="Write detailed new notes about the current call/meeting..." />
              </div>
              <p className="text-[10px] text-gray-400 -mt-2">These notes will be independently saved to the interaction history log.</p>
              </div>
            </div>

            <div className="px-4 sm:px-5 py-3 border-t shrink-0">
              <button type="submit" className="px-4 py-2 bg-blue-600 font-bold hover:bg-blue-700 text-white rounded w-full">Confirm & Continue</button>
            </div>
          </form>
        </div>
      )}

      {showClosingForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 my-8">
            <h3 className="text-xl font-bold mb-6 border-b pb-2">Deal Closing Form</h3>
            <form onSubmit={closeDeal} className="space-y-4">
              {/* Package Services — multi-select checkboxes, optionally per-month */}
              <div className="border rounded-lg p-3 bg-gray-50/60">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                  <label className="block text-sm font-bold text-gray-800">Package Services</label>
                  <div className="flex items-center gap-1 bg-white border rounded-lg p-0.5 text-xs font-medium">
                    <button
                      type="button"
                      onClick={() => setDealData({ ...dealData, packageMode: "unified" })}
                      className={`px-2.5 py-1 rounded-md transition-colors ${dealData.packageMode === "unified" ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}
                    >
                      Same every month
                    </button>
                    <button
                      type="button"
                      onClick={() => setDealData({ ...dealData, packageMode: "monthly" })}
                      className={`px-2.5 py-1 rounded-md transition-colors ${dealData.packageMode === "monthly" ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}
                    >
                      Different per month
                    </button>
                  </div>
                </div>

                {dealData.packageMode === "unified" ? (
                  <div className="flex flex-wrap gap-2">
                    {PACKAGE_SERVICES.map(s => {
                      const checked = dealData.packageServices.includes(s.value);
                      return (
                        <label key={s.value} className={`flex items-center gap-2 text-sm rounded-lg border px-3 py-2 cursor-pointer transition-colors ${checked ? "border-blue-500 bg-blue-50 text-blue-700 font-medium" : "border-gray-200 bg-white hover:border-blue-300"}`}>
                          <input type="checkbox" checked={checked} onChange={() => toggleUnifiedService(s.value)} />
                          {s.label}
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {dealData.monthlyPackages.map((m, idx) => (
                      <div key={idx} className="bg-white border rounded-lg p-2.5">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">Month {idx + 1}</span>
                          {dealData.monthlyPackages.length > 1 && (
                            <button type="button" onClick={() => removePackageMonth(idx)} className="text-xs font-semibold text-red-500 hover:text-red-700">Remove</button>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {PACKAGE_SERVICES.map(s => {
                            const checked = m.services.includes(s.value);
                            return (
                              <label key={s.value} className={`flex items-center gap-2 text-sm rounded-lg border px-3 py-1.5 cursor-pointer transition-colors ${checked ? "border-blue-500 bg-blue-50 text-blue-700 font-medium" : "border-gray-200 bg-white hover:border-blue-300"}`}>
                                <input type="checkbox" checked={checked} onChange={() => toggleMonthlyService(idx, s.value)} />
                                {s.label}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    <button type="button" onClick={addPackageMonth} className="px-3 py-1.5 bg-blue-100 text-blue-700 hover:bg-blue-200 text-xs font-semibold rounded">+ Add Month</button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Total Amount (SAR)</label>
                  <input required type="number" min="0" className="w-full border p-2 rounded" value={dealData.totalAmount} onChange={e => setDealData({...dealData, totalAmount: e.target.value})} />
                  <p className="text-[10px] text-gray-400 mt-1">Full contract value</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-blue-700">First Payment Amount (SAR)</label>
                  <input required type="number" min="0" max={dealData.totalAmount || undefined} className="w-full border border-blue-200 p-2 rounded focus:ring-2 focus:ring-blue-500 bg-blue-50/30" placeholder="Amount paid at closing" value={dealData.firstAmount} onChange={e => setDealData({...dealData, firstAmount: e.target.value})} />
                  <p className="text-[10px] text-blue-500 mt-1 font-medium">💰 This amount will be counted in Total Revenue</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 flex justify-between">
                    <span className="text-gray-700">Remaining Balance</span>
                    <span className="text-gray-400 text-[10px] mt-0.5">Auto-calculated</span>
                  </label>
                  <input disabled type="number" className="w-full border p-2 rounded bg-gray-50 text-gray-500 font-semibold" value={Math.max(0, (parseFloat(dealData.totalAmount || "0") - parseFloat(dealData.firstAmount || "0")))} />
                  {parseFloat(dealData.firstAmount || "0") > parseFloat(dealData.totalAmount || "0") && (
                    <p className="text-[10px] text-red-500 mt-1 font-medium">⚠️ First payment cannot exceed total amount</p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Payment Setup</label>
                  <select className="w-full border p-2 rounded" value={dealData.paymentType} onChange={e => setDealData({...dealData, paymentType: e.target.value, installments: []})}>
                    <option value="Full">Full Payment Upfront</option>
                    <option value="Installments">Installments</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Payment Method</label>
                  <select className="w-full border p-2 rounded" value={dealData.paymentMethod} onChange={e => setDealData({...dealData, paymentMethod: e.target.value})}>
                    <option>Cash</option>
                    <option>Transfer</option>
                    <option>Tabby</option>
                    <option>Tamara</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Contract Start</label>
                  <input required type="date" className="w-full border p-2 rounded" value={dealData.contractStart} onChange={e => setDealData({...dealData, contractStart: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Contract End</label>
                  <input required type="date" className="w-full border p-2 rounded" value={dealData.contractEnd} onChange={e => setDealData({...dealData, contractEnd: e.target.value})} />
                </div>
              </div>
              
              {/* File Uploads */}
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div>
                  <label className="block text-sm font-medium mb-1">Upload Contract (Image URL)</label>
                  <input required type="url" placeholder="https://..." className="w-full border p-2 rounded" value={dealData.contractImageUrl} onChange={e => setDealData({...dealData, contractImageUrl: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Upload Receipt (Image URL)</label>
                  <input required type="url" placeholder="https://..." className="w-full border p-2 rounded" value={dealData.receiptUrl} onChange={e => setDealData({...dealData, receiptUrl: e.target.value})} />
                </div>
              </div>

              {dealData.paymentType === "Installments" && (
                <div className="mt-4 border-t pt-4">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-bold text-sm">Payment Installments Schedule</h4>
                    <button type="button" onClick={addInstallment} className="px-3 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 text-xs font-semibold rounded">+ Add Next Installment</button>
                  </div>
                  
                  {dealData.installments.map((inst, idx) => (
                    <div key={idx} className="flex gap-2 items-center mt-2">
                      <div className="w-1/2">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Due Date</label>
                        <input required type="date" className="w-full border p-2 rounded text-sm focus:ring-blue-500" value={inst.date} onChange={e => updateInstallment(idx, "date", e.target.value)} />
                      </div>
                      <div className="w-1/2 flex gap-2">
                        <div className="flex-1">
                          <label className="block text-xs font-medium text-gray-500 mb-1">Installment Amount (SAR)</label>
                          <input required type="number" className="w-full border p-2 rounded text-sm focus:ring-blue-500" value={inst.amount} onChange={e => updateInstallment(idx, "amount", e.target.value)} />
                        </div>
                        <button type="button" onClick={() => setDealData({ ...dealData, installments: dealData.installments.filter((_, i) => i !== idx) })} className="text-red-500 font-bold hover:text-red-700 mt-5 px-2">×</button>
                      </div>
                    </div>
                  ))}
                  {dealData.installments.length === 0 && (
                    <p className="text-sm text-gray-400 italic">Please add the remaining installments schedule.</p>
                  )}
                </div>
              )}
              
              <div className="mt-6 border-t pt-4">
                <button type="submit" className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded shadow-md">Confirm Deal & Send to Operations</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Send Link Modal */}
      {linkLead && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold mb-2">Send Meeting Link</h3>
            <p className="text-xs text-gray-500 mb-4">
              Send the Google Meet/Zoom link to {linkLead.teleAgent?.name} for client <span className="font-semibold">{linkLead.name}</span>. It will appear in their notification bell and Notifications page.
            </p>
            <form onSubmit={submitLink}>
              <input 
                type="url" 
                required 
                className="w-full border p-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 mb-4" 
                placeholder="https://meet.google.com/..." 
                value={meetingLink}
                onChange={e => setMeetingLink(e.target.value)}
              />
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setLinkLead(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg font-medium">Cancel</button>
                <button type="submit" disabled={sendingLink} className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium disabled:opacity-50">
                  {sendingLink ? "Sending..." : "Send Link"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
