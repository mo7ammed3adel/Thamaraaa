"use client";
import { useState } from "react";
import { PhoneCall, Calendar, Handshake, DollarSign, X, Clock } from "lucide-react";

interface Meeting {
  id: string;
  meetingDate: Date | string;
  meetingTime: string | null;
  status: string;
  salesNotes: string | null;
  summary: string | null;
  dealAmount: number | null;
  createdAt: Date | string;
  leadId: string;
  teleAgentId: string;
  salesAgentId: string | null;
  lead: {
    id: string;
    name: string;
    phone: string;
    classification: string;
    source: string | null;
    status: string;
    createdAt?: Date | string;
    salesAgent?: { name: string } | null;
    teleAgent?: { name: string; id: string } | null;
    callLogs?: { id: string; callStatus: string; notes: string; createdAt: Date | string; classification: string | null; agent: { name: string } }[];
    meetings?: { id: string; meetingDate: Date | string; meetingTime: string | null; status: string; salesNotes: string | null; summary: string | null; teleAgent: { name: string }; salesAgent: { name: string } | null }[];
    deals?: { id: string; totalAmount: number; package: string; paymentMethod: string; status: string; createdAt: Date | string; contractStart: Date | string | null; contractEnd: Date | string | null; salesAgent: { name: string }; installments?: { id: string; amount: number; dueDate: Date | string; isPaid: boolean }[] }[];
  };
  teleAgent: { name: string };
  salesAgent: { name: string } | null;
}

interface Performance {
  totalCalls: number;
  meetingsSet: number;
  dealsCount: number;
  revenue: number;
}

const statusColors: Record<string, string> = {
  Scheduled: "bg-gray-100 text-gray-700",
  Attended: "bg-blue-100 text-blue-700",
  Lost: "bg-red-100 text-red-700",
  Won: "bg-green-100 text-green-700",
};

export default function MeetsClient({
  meetings,
  performance,
  isAgent,
}: {
  meetings: Meeting[];
  performance: Performance | null;
  isAgent: boolean;
}) {
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);

  return (
    <div className="space-y-6">
      {/* Performance Summary for Agent */}
      {performance && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 text-white shadow-lg">
            <div className="flex items-center gap-2 mb-2">
              <PhoneCall className="h-5 w-5 opacity-80" />
              <span className="text-xs font-semibold uppercase opacity-80">Total Calls</span>
            </div>
            <p className="text-3xl font-bold">{performance.totalCalls}</p>
          </div>
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-5 text-white shadow-lg">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-5 w-5 opacity-80" />
              <span className="text-xs font-semibold uppercase opacity-80">Meetings Set</span>
            </div>
            <p className="text-3xl font-bold">{performance.meetingsSet}</p>
          </div>
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-5 text-white shadow-lg">
            <div className="flex items-center gap-2 mb-2">
              <Handshake className="h-5 w-5 opacity-80" />
              <span className="text-xs font-semibold uppercase opacity-80">Deals Closed</span>
            </div>
            <p className="text-3xl font-bold">{performance.dealsCount}</p>
          </div>
          <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-5 text-white shadow-lg">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-5 w-5 opacity-80" />
              <span className="text-xs font-semibold uppercase opacity-80">Revenue</span>
            </div>
            <p className="text-3xl font-bold">{performance.revenue.toLocaleString()}</p>
            <p className="text-xs opacity-70 mt-1">SAR</p>
          </div>
        </div>
      )}

      {/* Meetings Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
            Meetings ({meetings.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lead</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Classification</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                {!isAgent && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tele Agent</th>}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sales Agent</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date & Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {meetings.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => setSelectedMeeting(m)}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{m.lead.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-mono">{m.lead.phone}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      m.lead.classification === "Hot" ? "bg-red-100 text-red-700" :
                      m.lead.classification === "Warm" ? "bg-amber-100 text-amber-700" :
                      "bg-blue-100 text-blue-700"
                    }`}>
                      {m.lead.classification}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{m.lead.source || "—"}</td>
                  {!isAgent && <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{m.teleAgent.name}</td>}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{m.salesAgent?.name || m.lead.salesAgent?.name || "—"}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {new Date(m.meetingDate).toLocaleDateString("en-GB")}
                    {m.meetingTime && <span className="text-gray-400 ml-1">{m.meetingTime}</span>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[m.status] || "bg-gray-100 text-gray-700"}`}>
                      {m.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 max-w-xs">
                    <div className="line-clamp-3">
                      {m.salesNotes && <p><span className="font-semibold text-gray-700">Sales Note:</span> {m.salesNotes}</p>}
                      {m.summary && <p><span className="font-semibold text-gray-700">Summary:</span> {m.summary}</p>}
                      {!m.summary && !m.salesNotes && "—"}
                    </div>
                  </td>
                </tr>
              ))}
              {meetings.length === 0 && (
                <tr><td colSpan={isAgent ? 8 : 9} className="px-6 py-8 text-center text-sm text-gray-500">No meetings found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Client Journey Popup */}
      {selectedMeeting && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setSelectedMeeting(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-blue-50 to-indigo-50">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{selectedMeeting.lead.name} — Client Journey</h3>
                <p className="text-sm text-gray-500">{selectedMeeting.lead.phone} • {selectedMeeting.lead.classification} Lead • Source: {selectedMeeting.lead.source || "Unknown"}</p>
              </div>
              <button onClick={() => setSelectedMeeting(null)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded-lg transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Timeline */}
              <div>
                <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-4">Full Process Timeline</h4>
                <div className="relative border-l-2 border-gray-200 pl-6 space-y-4">
                  {/* Lead Entry */}
                  <div className="relative">
                    <div className="absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-blue-500 border-2 border-white" />
                    <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-blue-700 uppercase">Lead Created</span>
                        {selectedMeeting.lead.createdAt && (
                          <span className="text-xs text-gray-400">{new Date(selectedMeeting.lead.createdAt).toLocaleDateString("en-GB")}</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">
                        {selectedMeeting.lead.name} entered the system as a {selectedMeeting.lead.classification} lead
                        {selectedMeeting.lead.teleAgent ? ` assigned to ${selectedMeeting.lead.teleAgent.name}` : ""}.
                      </p>
                    </div>
                  </div>

                  {/* Call Logs */}
                  {selectedMeeting.lead.callLogs?.map((log) => (
                    <div key={log.id} className="relative">
                      <div className={`absolute -left-[31px] top-1 w-4 h-4 rounded-full border-2 border-white ${
                        log.callStatus === "Accept and book meeting" ? "bg-green-500" :
                        log.callStatus === "Answered" ? "bg-blue-400" : "bg-gray-400"
                      }`} />
                      <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                        <div className="flex items-center gap-2 mb-1">
                          <PhoneCall className="h-3 w-3 text-gray-500" />
                          <span className="text-xs font-bold text-gray-700 uppercase">Call — {log.callStatus}</span>
                          <span className="text-xs text-gray-400">{new Date(log.createdAt).toLocaleDateString("en-GB")}</span>
                          <span className="text-xs text-gray-400">by {log.agent.name}</span>
                        </div>
                        {log.classification && (
                          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium mb-1 ${
                            log.classification === "Hot" ? "bg-red-100 text-red-700" :
                            log.classification === "Warm" ? "bg-amber-100 text-amber-700" :
                            "bg-blue-100 text-blue-700"
                          }`}>{log.classification}</span>
                        )}
                        <p className="text-sm text-gray-600">{log.notes}</p>
                      </div>
                    </div>
                  ))}

                  {/* Meetings */}
                  {selectedMeeting.lead.meetings?.map((m) => (
                    <div key={m.id} className="relative">
                      <div className={`absolute -left-[31px] top-1 w-4 h-4 rounded-full border-2 border-white ${
                        m.status === "Won" ? "bg-green-500" :
                        m.status === "Attended" ? "bg-indigo-500" :
                        m.status === "Lost" ? "bg-red-500" : "bg-purple-400"
                      }`} />
                      <div className="bg-purple-50 rounded-lg p-3 border border-purple-100">
                        <div className="flex items-center gap-2 mb-1">
                          <Calendar className="h-3 w-3 text-purple-500" />
                          <span className="text-xs font-bold text-purple-700 uppercase">Meeting — {m.status}</span>
                          <span className="text-xs text-gray-400">{new Date(m.meetingDate).toLocaleDateString("en-GB")} {m.meetingTime || ""}</span>
                        </div>
                        {m.salesAgent && (
                          <p className="text-xs text-purple-600">Sales Agent: {m.salesAgent.name}</p>
                        )}
                        {m.salesNotes && (
                          <p className="text-sm text-gray-600 mt-1 italic">Sales Notes: "{m.salesNotes}"</p>
                        )}
                        {m.summary && (
                          <p className="text-sm text-gray-600 mt-1">Summary: {m.summary}</p>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Deals */}
                  {selectedMeeting.lead.deals?.map((d) => (
                    <div key={d.id} className="relative">
                      <div className="absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-green-600 border-2 border-white ring-4 ring-green-100" />
                      <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                        <div className="flex items-center gap-2 mb-1">
                          <Handshake className="h-3 w-3 text-green-600" />
                          <span className="text-xs font-bold text-green-700 uppercase">Deal Closed — Won!</span>
                          <span className="text-xs text-gray-400">{new Date(d.createdAt).toLocaleDateString("en-GB")}</span>
                        </div>
                        <p className="text-sm text-gray-600">
                          Deal closed by <span className="font-semibold">{d.salesAgent.name}</span> for{" "}
                          <span className="font-bold text-green-700">{d.totalAmount.toLocaleString()} SAR</span> ({d.package} package, paid via {d.paymentMethod}).
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
