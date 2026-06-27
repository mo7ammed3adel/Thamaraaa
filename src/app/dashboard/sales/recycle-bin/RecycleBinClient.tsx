"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { updateLead } from "@/client/api/leads";

export default function RecycleBinClient({ leads, salesAgents }: { leads: any[], salesAgents: any[] }) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [selectedAgentForLead, setSelectedAgentForLead] = useState<Record<string, string>>({});

  const handleReassign = async (leadId: string) => {
    const newAgentId = selectedAgentForLead[leadId];
    if (!newAgentId) return alert("Select an agent first");

    setLoadingId(leadId);
    try {
      // Transfer back to the queue (Waiting or In_Sales)
      await updateLead(leadId, { 
        status: "In_Sales", 
        assignedSalesAgentId: newAgentId,
        notes: "Re-assigned from Recycle Bin",
        incrementRecycle: true
      });
      router.refresh();
    } catch (e) {
      console.error(e);
      alert("Failed to re-assign");
    }
    setLoadingId(null);
  };

  const handleArchive = async (leadId: string) => {
    if (!confirm("Are you sure you want to permanently archive this lead?")) return;
    setLoadingId(leadId);
    try {
      // Set archivedAt to current date
      await updateLead(leadId, { 
        status: "Archived",
        archived: true,
        notes: "Moved to final archive after max attempts."
      });
      router.refresh();
    } catch (e) {
      console.error(e);
      alert("Failed to archive");
    }
    setLoadingId(null);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client Name & Phone</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Previous Agent</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/3">Feedback Notes</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {leads.map((l) => {
              const feedback = l.callLogs[0]?.notes || "No standard feedback provided.";
              return (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{l.name}</div>
                    <div className="text-sm text-gray-500">{l.phone}</div>
                    {l.recycleCount > 0 && <span className="inline-flex mt-1 items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-100 text-rose-800">Recycled ({l.recycleCount})</span>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {l.salesAgent?.name || "Unknown"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    <p className="line-clamp-2 text-red-600 font-medium">{feedback}</p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right flex justify-end items-center gap-2">
                    {l.recycleCount === 0 ? (
                      <>
                        <select 
                          className="text-sm border-gray-300 rounded-md bg-gray-50 py-1.5 focus:border-blue-500"
                          value={selectedAgentForLead[l.id] || ""}
                          onChange={e => setSelectedAgentForLead({...selectedAgentForLead, [l.id]: e.target.value})}
                        >
                          <option value="">Select Agent...</option>
                          {salesAgents.map(ag => (
                            <option key={ag.id} value={ag.id}>{ag.name}</option>
                          ))}
                        </select>
                        <button 
                          onClick={() => handleReassign(l.id)} 
                          disabled={loadingId === l.id || !selectedAgentForLead[l.id]}
                          className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white rounded-md text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
                        >
                          <RotateCcw className="w-3 h-3 mr-1" />
                          {loadingId === l.id ? "Working..." : "Re-Assign"}
                        </button>
                      </>
                    ) : (
                      <button 
                        onClick={() => handleArchive(l.id)} 
                        disabled={loadingId === l.id}
                        className="inline-flex items-center px-3 py-1.5 bg-gray-800 text-white rounded-md text-xs font-medium hover:bg-black disabled:opacity-50"
                      >
                        {loadingId === l.id ? "Working..." : "Final Archive"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {leads.length === 0 && (
              <tr><td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-500">Recycle bin is empty. Great job!</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
