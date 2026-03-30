"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Flame, Snowflake, Sun } from "lucide-react";

interface Agent {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  specialization: string | null;
  status: string;
  level: string | null;
  _count: {
    salesLeads: number;
    salesDeals: number;
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

export default function SalesMyTeamClient({ agents: initialAgents }: { agents: Agent[] }) {
  const router = useRouter();
  const [agents, setAgents] = useState(initialAgents);
  const [loading, setLoading] = useState<string | null>(null);

  const updateSpecialization = async (agentId: string, spec: string | null) => {
    setLoading(agentId);
    try {
      const res = await fetch(`/api/users/${agentId}/specialization`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ specialization: spec }),
      });

      if (res.ok) {
        setAgents(agents.map(a => a.id === agentId ? { ...a, specialization: spec } : a));
      } else {
        alert("Failed to update specialization");
      }
    } catch {
      alert("Network error");
    }
    setLoading(null);
  };

  const hotCount = agents.filter(a => a.specialization === "Hot").length;
  const warmCount = agents.filter(a => a.specialization === "Warm").length;
  const coldCount = agents.filter(a => a.specialization === "Cold").length;
  const unassignedCount = agents.filter(a => !a.specialization).length;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 rounded-lg">
              <Users className="h-5 w-5 text-slate-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{agents.length}</p>
              <p className="text-xs text-gray-500">Total Agents</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-red-100 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-50 rounded-lg">
              <Flame className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{hotCount}</p>
              <p className="text-xs text-gray-500">Hot Agents</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-amber-100 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-50 rounded-lg">
              <Sun className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600">{warmCount}</p>
              <p className="text-xs text-gray-500">Warm Agents</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-blue-100 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Snowflake className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">{coldCount}</p>
              <p className="text-xs text-gray-500">Cold Agents</p>
            </div>
          </div>
        </div>
      </div>

      {/* Agents Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Agent</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Level</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Leads</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Closed Deals</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Specialization</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {agents.map((agent) => {
                const SpecIcon = agent.specialization ? specIcons[agent.specialization] : null;
                return (
                  <tr key={agent.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white text-sm font-bold">
                          {agent.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="ml-3">
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
                      <span className="text-sm font-semibold text-gray-900">{agent._count.salesLeads}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-semibold text-gray-900">{agent._count.salesDeals}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        agent.status === "Active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${agent.status === "Active" ? "bg-green-500" : "bg-gray-400"}`} />
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
              {agents.length === 0 && (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-500">No agents found under your management.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
