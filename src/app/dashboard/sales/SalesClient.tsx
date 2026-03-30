"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SalesClient({ initialLeads, userRole, userId, initialStatus }: { initialLeads: any[], userRole: string, userId: string, initialStatus: string }) {
  const router = useRouter();
  const [leads, setLeads] = useState(initialLeads);
  const [status, setStatus] = useState(initialStatus);
  const [activeLead, setActiveLead] = useState<any>(null);
  
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
    const newStatus = status === "Active" ? "Busy" : "Active";
    // Setup generic user status API route later, directly mutating for UI
    setStatus(newStatus);
    alert(`Status changed to ${newStatus}`);
  };

  const startTask = (lead: any) => {
    setStatus("Busy");
    setActiveLead(lead);
  };

  const endTask = () => {
    setShowFeedbackForm(true);
  };

  const submitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (feedback.outcome === "won") {
      setShowFeedbackForm(false);
      setShowClosingForm(true);
    } else if (feedback.outcome === "followup") {
      await fetch("/api/leads/" + activeLead.id, {
        method: "PATCH",
        body: JSON.stringify({ status: "Follow_Up", followUpDate: feedback.followUpDate, notes: feedback.notes })
      });
      setShowFeedbackForm(false);
      setActiveLead(null);
      router.refresh();
    } else if (feedback.outcome === "reschedule") {
      await fetch("/api/leads/" + activeLead.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Rescheduled", meetingDate: feedback.meetingDate, meetingTime: feedback.meetingTime, notes: feedback.notes })
      });
      setShowFeedbackForm(false);
      setActiveLead(null);
      router.refresh();
    } else {
      // Mark as lost/recycle
      await fetch("/api/leads/" + activeLead.id, {
        method: "PATCH",
        body: JSON.stringify({ status: "Closed_Lost", notes: feedback.notes })
      });
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
    setShowClosingForm(false);
    setActiveLead(null);
    setStatus("Active");
    router.refresh();
  };

  return (
    <div>
      <div className="mb-6 flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase">My Status</h2>
          <div className="flex items-center mt-2">
            <span className="relative flex h-3 w-3 mr-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${status === "Active" ? "bg-green-400" : "bg-red-400"}`}></span>
              <span className={`relative inline-flex rounded-full h-3 w-3 ${status === "Active" ? "bg-green-500" : "bg-red-500"}`}></span>
            </span>
            <span className="font-bold text-gray-900">{status}</span>
          </div>
        </div>
        <button onClick={toggleStatus} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50 transition">
          Toggle Status
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lead</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Classification</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Meeting Time</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Telesales Notes</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {leads.map((l) => (
              <tr key={l.id} className={`${activeLead?.id === l.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{l.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <span className="px-2 py-0.5 rounded text-xs bg-orange-100 text-orange-800 font-medium">{l.classification}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {l.meetings?.[0]?.meetingDate ? new Date(l.meetings[0].meetingDate).toLocaleDateString() : (l.meetingDate ? new Date(l.meetingDate).toLocaleDateString() : "N/A")} 
                  <br/>
                  <span className="text-xs text-blue-600 font-medium">{l.meetings?.[0]?.meetingTime || l.meetingTime || ""}</span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600 max-w-xs break-words">
                  {l.callLogs?.[0]?.notes || <span className="text-gray-400 italic">No notes provided</span>}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                  {activeLead?.id === l.id ? (
                    <button onClick={endTask} className="px-3 py-1.5 bg-red-600 text-white rounded-md text-xs font-medium hover:bg-red-700">End Task</button>
                  ) : (
                    <button onClick={() => startTask(l)} disabled={!!activeLead} className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-xs font-medium hover:bg-blue-700 disabled:opacity-50">Start Task</button>
                  )}
                </td>
              </tr>
            ))}
            {leads.length === 0 && (
              <tr><td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-500">No active leads in queue.</td></tr>
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
                <div className="flex gap-4">
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
