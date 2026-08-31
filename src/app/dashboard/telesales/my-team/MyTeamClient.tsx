"use client";
import { useState } from "react";
import { notify } from "@/components/toast";
import { useRouter } from "next/navigation";
import { Users, Flame, Snowflake, Sun, PhoneCall, Calendar, ArrowRightLeft, BarChart3 } from "lucide-react";
import { updateUserSpecialization, updateUserTarget } from "@/client/api/users";
import DateRangeFilter from "@/components/dashboard/DateRangeFilter";

interface Agent {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  specialization: string | null;
  status: string;
  level: string | null;
  transferredCount: number;
  target: number;
  /** Meetings the client actually attended in the target's month — the target metric. */
  actualMeetings: number;
  _count: {
    teleSalesLeads: number;
    callLogs: number;
    meetingsAsTele: number;
  };
}

const specColors: Record<string, string> = {
  Hot: "bg-red-100 text-red-700 border-red-200",
  Warm: "bg-amber-100 text-amber-700 border-amber-200",
  Cold: "bg-blue-100 text-blue-700 border-blue-200",
};

const specIcons: Record<string, any> = {
  Hot: Flame,
  Warm: Sun,
  Cold: Snowflake,
};

export default function MyTeamClient({ 
  agents: initialAgents, 
  initialFrom = "", 
  initialTo = "" 
}: { 
  agents: Agent[], 
  initialFrom?: string, 
  initialTo?: string 
}) {
  const router = useRouter();
  const [agents, setAgents] = useState(initialAgents);
  const [loading, setLoading] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState(initialFrom);
  const [toDate, setToDate] = useState(initialTo);
  const [activeSpecs, setActiveSpecs] = useState<string[]>([]); // Empty = All, otherwise contains Hot, Warm, Cold
  const [sortBy, setSortBy] = useState<string>("name"); // name, leads, calls, meetings, transferred

  const applyDateFilter = () => {
    const params = new URLSearchParams();
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    router.push(`/dashboard/telesales/my-team?${params.toString()}`);
  };

  const clearDateFilter = () => {
    setFromDate("");
    setToDate("");
    router.push(`/dashboard/telesales/my-team`);
  };

  const updateSpecialization = async (agentId: string, spec: string | null) => {
    setLoading(agentId);
    try {
      await updateUserSpecialization(agentId, { specialization: spec });
      setAgents(agents.map(a => a.id === agentId ? { ...a, specialization: spec } : a));
    } catch (error) {
      notify(error instanceof Error ? error.message : "Network error");
    }
    setLoading(null);
  };

  const updateTarget = async (agentId: string, newTarget: number) => {
    try {
      await updateUserTarget(agentId, { target: newTarget });
      setAgents(agents.map(a => a.id === agentId ? { ...a, target: newTarget } : a));
    } catch (error) {
      notify(error instanceof Error ? error.message : "Network error");
    }
  };

  const hotCount = agents.filter(a => a.specialization === "Hot").length;
  const warmCount = agents.filter(a => a.specialization === "Warm").length;
  const coldCount = agents.filter(a => a.specialization === "Cold").length;
  const unassignedCount = agents.filter(a => !a.specialization).length;

  const toggleSpec = (spec: string) => {
    setActiveSpecs((prev) => 
      prev.includes(spec) ? prev.filter(s => s !== spec) : [...prev, spec]
    );
  };

  const clearAllFilters = () => {
    setActiveSpecs([]);
    setSortBy("name");
  };

  let displayAgents = [...agents];
  if (activeSpecs.length > 0) {
    displayAgents = displayAgents.filter(a => a.specialization && activeSpecs.includes(a.specialization));
  }

  displayAgents.sort((a, b) => {
    if (sortBy === "leads") return b._count.teleSalesLeads - a._count.teleSalesLeads;
    if (sortBy === "calls") return b._count.callLogs - a._count.callLogs;
    if (sortBy === "meetings") return b._count.meetingsAsTele - a._count.meetingsAsTele;
    if (sortBy === "transferred") return b.transferredCount - a.transferredCount;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="space-y-6">
      <DateRangeFilter
        fromDate={fromDate}
        toDate={toDate}
        onFromDateChange={setFromDate}
        onToDateChange={setToDate}
        onApply={applyDateFilter}
        onReset={clearDateFilter}
        label="Team Date Range"
        description="Filters team calls and meetings by the selected period."
      />

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div 
          onClick={() => setSortBy(sortBy === "leads" ? "name" : "leads")}
          className={`cursor-pointer bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white shadow-lg transition-transform hover:scale-[1.02] ${sortBy === "leads" ? "ring-4 ring-blue-300" : ""}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="h-5 w-5 opacity-80" />
            <span className="text-xs font-semibold uppercase opacity-80">Total Leads</span>
          </div>
          <p className="text-3xl font-bold">{displayAgents.reduce((s, a) => s + a._count.teleSalesLeads, 0)}</p>
        </div>
        <div 
          onClick={() => setSortBy(sortBy === "calls" ? "name" : "calls")}
          className={`cursor-pointer bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl p-4 text-white shadow-lg transition-transform hover:scale-[1.02] ${sortBy === "calls" ? "ring-4 ring-indigo-300" : ""}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <PhoneCall className="h-5 w-5 opacity-80" />
            <span className="text-xs font-semibold uppercase opacity-80">Total Calls</span>
          </div>
          <p className="text-3xl font-bold">{displayAgents.reduce((s, a) => s + a._count.callLogs, 0)}</p>
        </div>
        <div 
          onClick={() => setSortBy(sortBy === "meetings" ? "name" : "meetings")}
          className={`cursor-pointer bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white shadow-lg transition-transform hover:scale-[1.02] ${sortBy === "meetings" ? "ring-4 ring-purple-300" : ""}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="h-5 w-5 opacity-80" />
            <span className="text-xs font-semibold uppercase opacity-80">Meetings Booked</span>
          </div>
          <p className="text-3xl font-bold">{displayAgents.reduce((s, a) => s + a._count.meetingsAsTele, 0)}</p>
        </div>
        <div 
          onClick={() => setSortBy(sortBy === "transferred" ? "name" : "transferred")}
          className={`cursor-pointer bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-4 text-white shadow-lg transition-transform hover:scale-[1.02] ${sortBy === "transferred" ? "ring-4 ring-emerald-300" : ""}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <ArrowRightLeft className="h-5 w-5 opacity-80" />
            <span className="text-xs font-semibold uppercase opacity-80">Transferred</span>
          </div>
          <p className="text-3xl font-bold">{displayAgents.reduce((s, a) => s + (a.transferredCount || 0), 0)}</p>
        </div>
      </div>

      {/* Specialization Breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div 
          onClick={() => setActiveSpecs([])}
          className={`cursor-pointer bg-white rounded-xl border p-4 shadow-sm transition-all hover:border-slate-400 ${activeSpecs.length === 0 ? "ring-2 ring-slate-400 bg-slate-50" : "border-gray-200"}`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 rounded-lg">
              <Users className="h-5 w-5 text-slate-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{agents.length}</p>
              <p className="text-xs text-gray-500 uppercase font-semibold">Total Agents</p>
            </div>
          </div>
        </div>
        <div 
          onClick={() => toggleSpec("Hot")}
          className={`cursor-pointer bg-white rounded-xl border p-4 shadow-sm transition-all hover:border-red-400 ${activeSpecs.includes("Hot") ? "ring-2 ring-red-400 bg-red-50/50" : "border-red-100"}`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-50 rounded-lg">
              <Flame className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{hotCount}</p>
              <p className="text-xs text-gray-500 uppercase font-semibold">Hot Agents</p>
            </div>
          </div>
        </div>
        <div 
          onClick={() => toggleSpec("Warm")}
          className={`cursor-pointer bg-white rounded-xl border p-4 shadow-sm transition-all hover:border-amber-400 ${activeSpecs.includes("Warm") ? "ring-2 ring-amber-400 bg-amber-50/50" : "border-amber-100"}`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-50 rounded-lg">
              <Sun className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600">{warmCount}</p>
              <p className="text-xs text-gray-500 uppercase font-semibold">Warm Agents</p>
            </div>
          </div>
        </div>
        <div 
          onClick={() => toggleSpec("Cold")}
          className={`cursor-pointer bg-white rounded-xl border p-4 shadow-sm transition-all hover:border-blue-400 ${activeSpecs.includes("Cold") ? "ring-2 ring-blue-400 bg-blue-50/50" : "border-blue-100"}`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Snowflake className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">{coldCount}</p>
              <p className="text-xs text-gray-500 uppercase font-semibold">Cold Agents</p>
            </div>
          </div>
        </div>
      </div>

      {/* Active Filters Bar */}
      {(activeSpecs.length > 0 || sortBy !== "name") && (
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-blue-800 me-2 uppercase">Active Filters:</span>
          {sortBy !== "name" && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-white border border-blue-200 text-blue-700 shadow-sm">
              Sorted by: <span className="capitalize">{sortBy}</span>
              <button onClick={() => setSortBy("name")} className="ms-1 hover:text-red-500"><svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </span>
          )}
          {activeSpecs.map(spec => (
            <span key={spec} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium shadow-sm border ${specColors[spec]}`}>
              {spec} Agents
              <button onClick={() => toggleSpec(spec)} className="ms-1 hover:opacity-70"><svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </span>
          ))}
          <button onClick={clearAllFilters} className="ms-auto text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline">
            Clear all filters
          </button>
        </div>
      )}

      {/* Agents Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">Agent</th>
                <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">Level</th>
                <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">Leads</th>
                <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">Calls</th>
                <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">Meetings (Month)</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Target</th>
                <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">Transferred</th>
                <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">Specialization</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {displayAgents.map((agent) => {
                const SpecIcon = agent.specialization ? specIcons[agent.specialization] : null;
                return (
                  <tr key={agent.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold">
                          {agent.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="ms-3">
                          <p className="text-sm font-semibold text-gray-900">{agent.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="text-sm text-gray-600">{agent.email}</p>
                      <p className="text-xs text-gray-400">{agent.phone || "—"}</p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-700 font-medium">{agent.level || "—"}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-semibold text-gray-900">{agent._count.teleSalesLeads}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-semibold text-gray-900">{agent._count.callLogs}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-purple-700">{agent._count.meetingsAsTele}</span>
                        {agent.target > 0 && (
                          <div
                            className="flex items-center gap-1.5"
                            title={`Actual meetings (client attended) this month: ${agent.actualMeetings} of ${agent.target} target`}
                          >
                            <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${
                                  (agent.actualMeetings / agent.target) >= 1 ? 'bg-green-500' :
                                  (agent.actualMeetings / agent.target) >= 0.5 ? 'bg-yellow-400' : 'bg-red-400'
                                }`}
                                style={{ width: `${Math.min(100, (agent.actualMeetings / agent.target) * 100)}%` }}
                              />
                            </div>
                            <span className="text-xs font-bold text-teal-600">{agent.actualMeetings}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <input 
                        type="number" 
                        min="0"
                        className="w-16 text-center text-sm border-b-2 border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none bg-transparent transition-colors font-bold text-gray-700"
                        defaultValue={agent.target}
                        onBlur={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          if (val !== agent.target) updateTarget(agent.id, val);
                        }}
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-semibold text-emerald-700">{agent.transferredCount}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        agent.status === "Active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full me-1.5 ${agent.status === "Active" ? "bg-green-500" : "bg-gray-400"}`} />
                        {agent.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={agent.specialization || ""}
                        onChange={(e) => updateSpecialization(agent.id, e.target.value || null)}
                        disabled={loading === agent.id}
                        className={`text-sm border rounded-lg px-3 py-1.5 font-medium transition-all cursor-pointer focus:ring-2 focus:ring-blue-500 disabled:opacity-50 ${
                          agent.specialization ? specColors[agent.specialization] : "bg-gray-50 text-gray-600 border-gray-200"
                        }`}
                      >
                        <option value="">Unassigned</option>
                        <option value="Hot">🔥 Hot</option>
                        <option value="Warm">☀️ Warm</option>
                        <option value="Cold">❄️ Cold</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
              {displayAgents.length === 0 && (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-500">No agents found under your management.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
