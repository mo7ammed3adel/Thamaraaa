"use client";
import { PhoneCall, Calendar, Handshake, DollarSign } from "lucide-react";

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
    salesAgent?: { name: string } | null;
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
                <tr key={m.id} className="hover:bg-gray-50 transition-colors">
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
                    <p className="line-clamp-2">{m.summary || m.salesNotes || "—"}</p>
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
    </div>
  );
}
