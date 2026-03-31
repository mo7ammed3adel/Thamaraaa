"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, PhoneCall, CheckCircle2, PhoneOff, XCircle } from "lucide-react";

export default function SalesClient({ initialLeads, userRole, userId, initialStatus }: { initialLeads: any[], userRole: string, userId: string, initialStatus: string }) {
  const router = useRouter();
  const [leads, setLeads] = useState(initialLeads);
  const [status, setStatus] = useState(initialStatus);
  const [activeLead, setActiveLead] = useState<any>(null);
  const [expandedLead, setExpandedLead] = useState<string | null>(null);
  const [logFilter, setLogFilter] = useState("All");
  
  // Deal closing form
  const [showClosingForm, setShowClosingForm] = useState(false);
  const [dealData, setDealData] = useState({
    packageType: "SEO",
    contractStart: "",
    contractEnd: "",
    totalAmount: "",
    paymentMethod: "Cash",
    installments: [] as any[],
    contractImageUrl: "",
    receiptUrl: ""
  });

  // Feedback form
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [feedback, setFeedback] = useState({
    notes: "",
    outcome: "won", // "won", "lost", "followup", "reschedule"
    followUpDate: "",
    meetingDate: "",
    meetingTime: "",
    hasStore: false,
    storeUrl: ""
  });

  const toggleStatus = async () => {
    if (status === "In_Call") return;
    const newStatus = status === "Active" ? "Busy" : "Active";
    setStatus(newStatus);
    await fetch(`/api/users/${userId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus })
    });
  };

  const startTask = async (lead: any) => {
    setStatus("In_Call");
    setActiveLead(lead);
    await fetch(`/api/users/${userId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "In_Call" })
    });
  };

  const endTask = () => {
    setShowFeedbackForm(true);
  };

  const submitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (feedback.outcome === "won") {
      setShowFeedbackForm(false);
      setShowClosingForm(true);
    } else {
      if (feedback.outcome === "followup") {
        await fetch("/api/leads/" + activeLead.id, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "Follow_Up", followUpDate: feedback.followUpDate, notes: feedback.notes })
        });
      } else if (feedback.outcome === "reschedule") {
        await fetch("/api/leads/" + activeLead.id, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "Rescheduled", meetingDate: feedback.meetingDate, meetingTime: feedback.meetingTime, notes: feedback.notes })
        });
      } else {
        await fetch("/api/leads/" + activeLead.id, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "Closed_Lost", notes: feedback.notes })
        });
      }
      
      await fetch(`/api/users/${userId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Active" })
      });
      setStatus("Active");
      setShowFeedbackForm(false);
      setActiveLead(null);
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

  const closeDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/deals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leadId: activeLead.id,
        ...dealData
      })
    });
    
    await fetch(`/api/users/${userId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "Active" })
    });
    setStatus("Active");
    setShowClosingForm(false);
    setActiveLead(null);
    router.refresh();
  };

  const classColor = (cls: string) => {
    if (cls === "Hot") return "bg-red-100 text-red-700";
    if (cls === "Warm") return "bg-amber-100 text-amber-700";
    return "bg-blue-100 text-blue-700";
  };

  return (
    <div>
      <div className="mb-6 flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase">My Status</h2>
          <div className="flex items-center mt-2">
            <span className="relative flex h-3 w-3 mr-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${status === "Active" ? "bg-green-400" : status === "In_Call" ? "bg-red-400" : "bg-yellow-400"}`}></span>
              <span className={`relative inline-flex rounded-full h-3 w-3 ${status === "Active" ? "bg-green-500" : status === "In_Call" ? "bg-red-500" : "bg-yellow-500"}`}></span>
            </span>
            <span className="font-bold text-gray-900">{status.replace("_", " ")}</span>
          </div>
        </div>
        <button onClick={toggleStatus} disabled={status === "In_Call"} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50 transition disabled:opacity-50">
          Toggle Status
        </button>
      </div>

      {/* Workspace Summary Filters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div 
          onClick={() => setLogFilter(logFilter === "All" ? "All" : "All")} 
          className={`cursor-pointer rounded-xl p-4 shadow-sm transition-all border-2 ${logFilter === "All" ? "border-blue-500 bg-blue-50" : "border-transparent bg-white hover:bg-gray-50"}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <PhoneCall className="h-5 w-5 text-blue-500" />
            <span className="text-xs font-bold uppercase text-gray-500">Total Leads</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{leads.length}</p>
        </div>

        <div 
          onClick={() => setLogFilter(logFilter === "Accept and book meeting" ? "All" : "Accept and book meeting")} 
          className={`cursor-pointer rounded-xl p-4 shadow-sm transition-all border-2 ${logFilter === "Accept and book meeting" ? "border-green-500 bg-green-50" : "border-transparent bg-white hover:bg-gray-50"}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <span className="text-xs font-bold uppercase text-gray-500">Accept & Booked</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{leads.filter(l => l.callLogs?.[0]?.callStatus === "Accept and book meeting").length}</p>
        </div>

        <div 
          onClick={() => setLogFilter(logFilter === "Accept but lost" ? "All" : "Accept but lost")} 
          className={`cursor-pointer rounded-xl p-4 shadow-sm transition-all border-2 ${logFilter === "Accept but lost" ? "border-orange-500 bg-orange-50" : "border-transparent bg-white hover:bg-gray-50"}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="h-5 w-5 text-orange-500" />
            <span className="text-xs font-bold uppercase text-gray-500">Accept But Lost</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{leads.filter(l => l.callLogs?.[0]?.callStatus === "Accept but lost").length}</p>
        </div>

        <div 
          onClick={() => setLogFilter(logFilter === "Busy" ? "All" : "Busy")} 
          className={`cursor-pointer rounded-xl p-4 shadow-sm transition-all border-2 ${logFilter === "Busy" ? "border-slate-500 bg-slate-50" : "border-transparent bg-white hover:bg-gray-50"}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <PhoneOff className="h-5 w-5 text-slate-500" />
            <span className="text-xs font-bold uppercase text-gray-500">Busy</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{leads.filter(l => l.callLogs?.[0]?.callStatus === "Busy").length}</p>
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
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Note</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {leads.filter(l => logFilter === "All" || l.callLogs?.[0]?.callStatus === logFilter).map((l) => (
              <>
                <tr key={l.id} className={`${activeLead?.id === l.id ? 'bg-blue-50' : 'hover:bg-gray-50'} transition-colors`}>
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
                    {l.teleAgent?.name || <span className="text-gray-400 italic">—</span>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {l.meetings?.[0]?.meetingDate ? new Date(l.meetings[0].meetingDate).toLocaleDateString() : (l.meetingDate ? new Date(l.meetingDate).toLocaleDateString() : "N/A")} 
                    <br/>
                    <span className="text-xs text-blue-600 font-medium">{l.meetings?.[0]?.meetingTime || l.meetingTime || ""}</span>
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
                    {activeLead?.id === l.id ? (
                      <button onClick={endTask} className="px-3 py-1.5 bg-red-600 text-white rounded-md text-xs font-medium hover:bg-red-700">End Task</button>
                    ) : (
                      <button onClick={() => startTask(l)} disabled={!!activeLead} className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-xs font-medium hover:bg-blue-700 disabled:opacity-50">Start Task</button>
                    )}
                  </td>
                </tr>
                {/* Expanded Call Logs */}
                {expandedLead === l.id && l.callLogs && l.callLogs.length > 0 && (
                  <tr key={`${l.id}-logs`}>
                    <td colSpan={7} className="px-6 py-3 bg-slate-50">
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
              </>
            ))}
            {leads.length === 0 && (
              <tr><td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-500">No active leads in queue.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showFeedbackForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold mb-4">Task Feedback</h3>
            <form onSubmit={submitFeedback} className="space-y-4">
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
                    <input required type="date" className="w-full border p-2 rounded focus:ring-blue-500" value={feedback.meetingDate} onChange={e => setFeedback({...feedback, meetingDate: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-blue-700">New Meeting Time</label>
                    <input required type="time" className="w-full border p-2 rounded focus:ring-blue-500" value={feedback.meetingTime} onChange={e => setFeedback({...feedback, meetingTime: e.target.value})} />
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1">Meeting Notes</label>
                <textarea required rows={3} className="w-full border p-2 rounded" value={feedback.notes} onChange={e => setFeedback({...feedback, notes: e.target.value})} />
              </div>
              <div className="flex justify-end gap-3 mt-6">
               <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Continue</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showClosingForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 my-8">
            <h3 className="text-xl font-bold mb-6 border-b pb-2">Deal Closing Form</h3>
            <form onSubmit={closeDeal} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Package</label>
                  <select className="w-full border p-2 rounded" value={dealData.packageType} onChange={e => setDealData({...dealData, packageType: e.target.value})}>
                    <option>SEO</option>
                    <option>Social</option>
                    <option>Full</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Total Amount (SAR)</label>
                  <input required type="number" className="w-full border p-2 rounded" value={dealData.totalAmount} onChange={e => setDealData({...dealData, totalAmount: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Contract Start</label>
                  <input required type="date" className="w-full border p-2 rounded" value={dealData.contractStart} onChange={e => setDealData({...dealData, contractStart: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Contract End</label>
                  <input required type="date" className="w-full border p-2 rounded" value={dealData.contractEnd} onChange={e => setDealData({...dealData, contractEnd: e.target.value})} />
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
              </div>
              
              <div className="mt-4 border-t pt-4">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-bold text-sm">Payment Installments</h4>
                  <button type="button" onClick={addInstallment} className="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-xs font-semibold rounded">+ Add Installment</button>
                </div>
                {dealData.installments.map((inst, idx) => (
                  <div key={idx} className="flex gap-2 items-center mt-2">
                    <div className="w-1/2">
                      <input required type="date" placeholder="Date" className="w-full border p-2 rounded text-sm" value={inst.date} onChange={e => updateInstallment(idx, "date", e.target.value)} />
                    </div>
                    <div className="w-1/2 flex items-center gap-2">
                      <input required type="number" placeholder="Amount (SAR)" className="w-full border p-2 rounded text-sm" value={inst.amount} onChange={e => updateInstallment(idx, "amount", e.target.value)} />
                      <button type="button" onClick={() => setDealData({ ...dealData, installments: dealData.installments.filter((_, i) => i !== idx) })} className="text-red-500 font-bold hover:text-red-700">×</button>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-6 border-t pt-4">
                <button type="submit" className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded shadow-md">Confirm Deal & Send to Operations</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
