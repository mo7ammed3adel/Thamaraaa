"use client";
import { useState } from "react";
import { RotateCcw, CheckSquare, Square, Users } from "lucide-react";

interface Lead {
  id: string;
  name: string;
  phone: string;
  classification: string;
  status: string;
  createdAt: Date;
  assignedTeleAgentId: string | null;
  teleAgent: { name: string } | null;
  salesAgent: { name: string } | null;
  callLogs: { notes: string; createdAt: Date }[];
  meetings: { status: string; salesAgent: { name: string } | null; createdAt: Date }[];
}

interface Agent {
  id: string;
  name: string;
}

export default function RecycleHotLeadsClient({ leads: initialLeads, agents }: { leads: Lead[]; agents: Agent[] }) {
  const [leads, setLeads] = useState(initialLeads);
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [lostFromAgent, setLostFromAgent] = useState("");
  const [assignToAgent, setAssignToAgent] = useState("");
  const [loading, setLoading] = useState(false);
  const [filterClass, setFilterClass] = useState("All");

  const toggleSelect = (id: string) => {
    const next = new Set(selectedLeads);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedLeads(next);
  };

  const selectAll = () => {
    if (selectedLeads.size === leads.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(leads.map(l => l.id)));
    }
  };

  const handleRedistribute = async () => {
    if (!assignToAgent) return alert("Select an agent to assign");
    if (selectedLeads.size === 0) return alert("Select at least one lead");

    setLoading(true);
    try {
      const promises = Array.from(selectedLeads).map(async leadId => {
        const res = await fetch(`/api/leads/${leadId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "New",
            assignedTeleAgentId: assignToAgent,
            notes: "Recycled from lost leads",
            incrementRecycle: true
          }),
        });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP Error ${res.status}`);
        }
      });
      await Promise.all(promises);
      // Remove redistributed leads from local state
      setLeads(leads.filter(l => !selectedLeads.has(l.id)));
      setSelectedLeads(new Set());
      setAssignToAgent("");
    } catch (error: any) {
      alert("Failed to redistribute leads: " + (error.message || "Unknown error"));
    }
    setLoading(false);
  };

  const hotLeads = leads.filter(l => l.classification === "Hot");
  const warmLeads = leads.filter(l => l.classification === "Warm");
  const coldLeads = leads.filter(l => l.classification === "Cold");

  let filteredLeads = leads;
  if (filterClass !== "All") {
    filteredLeads = filteredLeads.filter(l => l.classification === filterClass);
  }
  if (lostFromAgent) {
    filteredLeads = filteredLeads.filter(l => l.assignedTeleAgentId === lostFromAgent);
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div 
          onClick={() => setFilterClass(filterClass === "Hot" ? "All" : "Hot")}
          className={`cursor-pointer transition-all border rounded-xl p-4 hover:shadow-md ${filterClass === "Hot" ? "bg-red-100 border-red-300 ring-2 ring-red-400" : "bg-red-50 border-red-200"}`}
        >
          <p className="text-2xl font-bold text-red-600">{hotLeads.length}</p>
          <p className="text-xs text-red-500 font-medium">🔥 Hot Lost Leads</p>
        </div>
        <div 
          onClick={() => setFilterClass(filterClass === "Warm" ? "All" : "Warm")}
          className={`cursor-pointer transition-all border rounded-xl p-4 hover:shadow-md ${filterClass === "Warm" ? "bg-amber-100 border-amber-300 ring-2 ring-amber-400" : "bg-amber-50 border-amber-200"}`}
        >
          <p className="text-2xl font-bold text-amber-600">{warmLeads.length}</p>
          <p className="text-xs text-amber-500 font-medium">☀️ Warm Lost Leads</p>
        </div>
        <div 
          onClick={() => setFilterClass(filterClass === "Cold" ? "All" : "Cold")}
          className={`cursor-pointer transition-all border rounded-xl p-4 hover:shadow-md ${filterClass === "Cold" ? "bg-blue-100 border-blue-300 ring-2 ring-blue-400" : "bg-blue-50 border-blue-200"}`}
        >
          <p className="text-2xl font-bold text-blue-600">{coldLeads.length}</p>
          <p className="text-xs text-blue-500 font-medium">❄️ Cold Lost Leads</p>
        </div>
      </div>

      {/* Bulk Actions */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-wrap gap-4 items-end">
        <div className="flex items-center gap-3">
          <div>
            <label className="block text-xs font-semibold text-red-500 mb-1 uppercase">Lost From Agent</label>
            <select
              value={lostFromAgent}
              onChange={(e) => {
                setLostFromAgent(e.target.value);
                setSelectedLeads(new Set()); // Reset selections when filter changes
              }}
              className="border border-red-300 bg-red-50 text-red-800 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 min-w-[200px]"
            >
              <option value="">All Agents</option>
              {agents.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="hidden sm:block text-gray-300 px-2 lg:px-4">
          <svg className="w-6 h-6 transform rotate-90 sm:rotate-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
        </div>

        <div className="flex items-center gap-3">
          <Users className="h-5 w-5 text-gray-400" />
          <div>
            <label className="block text-xs font-semibold text-blue-600 mb-1 uppercase">Assign To Agent</label>
            <select
              value={assignToAgent}
              onChange={(e) => setAssignToAgent(e.target.value)}
              className="border border-blue-300 bg-blue-50 text-blue-800 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 min-w-[200px]"
            >
              <option value="">Select Agent...</option>
              {agents.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 ml-auto">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Filter by Class</label>
            <select
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 min-w-[150px]"
            >
              <option value="All">All Classifications</option>
              <option value="Hot">🔥 Hot</option>
              <option value="Warm">☀️ Warm</option>
              <option value="Cold">❄️ Cold</option>
            </select>
          </div>
        </div>
        <button
          onClick={handleRedistribute}
          disabled={loading || selectedLeads.size === 0 || !assignToAgent}
          className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-sm whitespace-nowrap"
        >
          <RotateCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Redistributing..." : `Redistribute (${selectedLeads.size})`}
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left">
                  <button onClick={selectAll} className="text-gray-400 hover:text-gray-600">
                    {selectedLeads.size === leads.length && leads.length > 0 ? <CheckSquare className="h-4 w-4 text-blue-600" /> : <Square className="h-4 w-4" />}
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Classification</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Previous Tele Agent</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Previous Sales Agent</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Notes</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date Lost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredLeads.map((lead) => (
                <tr key={lead.id} className={`hover:bg-gray-50 transition-colors ${selectedLeads.has(lead.id) ? "bg-blue-50" : ""}`}>
                  <td className="px-4 py-4">
                    <button onClick={() => toggleSelect(lead.id)} className="text-gray-400 hover:text-gray-600">
                      {selectedLeads.has(lead.id) ? <CheckSquare className="h-4 w-4 text-blue-600" /> : <Square className="h-4 w-4" />}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{lead.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-mono">{lead.phone}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      lead.classification === "Hot" ? "bg-red-100 text-red-700" :
                      lead.classification === "Warm" ? "bg-amber-100 text-amber-700" :
                      "bg-blue-100 text-blue-700"
                    }`}>
                      {lead.classification === "Hot" ? "🔥" : lead.classification === "Warm" ? "☀️" : "❄️"} {lead.classification}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{lead.teleAgent?.name || "—"}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{lead.salesAgent?.name || "—"}</td>
                  <td className="px-6 py-4 text-sm text-gray-500 max-w-xs">
                    <p className="line-clamp-2 text-red-600">{lead.callLogs[0]?.notes || "No notes"}</p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-400">
                    {lead.callLogs[0] ? new Date(lead.callLogs[0].createdAt).toLocaleDateString("en-GB") : "—"}
                  </td>
                </tr>
              ))}
              {filteredLeads.length === 0 && (
                <tr><td colSpan={8} className="px-6 py-8 text-center text-sm text-gray-500">No lost leads match your criteria. 🎉</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
