"use client";
import { useState, useEffect } from "react";
import { notify } from "@/components/toast";
import { useRouter } from "next/navigation";
import { Users, Flame, Snowflake, Sun, Handshake, XCircle, DollarSign, Briefcase, Calendar, ChevronDown } from "lucide-react";
import { updateUserSpecialization, updateUserTarget } from "@/client/api/users";
import { formatSarSuffix } from "@/shared/formatters/currency";
import { useTranslator } from "@/components/i18n/LocaleProvider";

interface Agent {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  specialization: string | null;
  status: string;
  level: string | null;
  lostCount: number;
  revenue: number;
  dealsWonCount: number;
  /** This month's contracted deal value (Closed_Won + Pending), compared against the fund target. */
  monthlyFund: number;
  target: number;
  _count: {
    salesLeads: number;
    salesDeals: number;
    meetingsAsSales: number;
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
  const t = useTranslator();
  const router = useRouter();
  const [agents, setAgents] = useState(initialAgents);
  const [loading, setLoading] = useState<string | null>(null);
  const [filterSpec, setFilterSpec] = useState<string>("All");
  const [activeCardFilter, setActiveCardFilter] = useState<string>("All");
  const [sortBy, setSortBy] = useState<string>("name");

  useEffect(() => {
    setAgents(initialAgents);
  }, [initialAgents]);

  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
    }, 20000);
    return () => clearInterval(interval);
  }, [router]);

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
      notify("Monthly target updated");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Network error");
    }
  };

  const hotCount = agents.filter(a => a.specialization === "Hot").length;
  const warmCount = agents.filter(a => a.specialization === "Warm").length;
  const coldCount = agents.filter(a => a.specialization === "Cold").length;
  const unassignedCount = agents.filter(a => !a.specialization).length;

  // 1. Stacked Filtering
  let displayAgents = [...agents];
  
  if (filterSpec !== "All") {
    displayAgents = displayAgents.filter(a => a.specialization === filterSpec);
  }
  
  if (activeCardFilter === "won") {
    displayAgents = displayAgents.filter(a => a.dealsWonCount > 0);
  } else if (activeCardFilter === "lost") {
    displayAgents = displayAgents.filter(a => a.lostCount > 0);
  } else if (activeCardFilter === "revenue") {
    displayAgents = displayAgents.filter(a => (a.revenue || 0) > 0);
  }

  // 2. Sorting
  const sortedAndFilteredAgents = displayAgents.sort((a, b) => {
    if (sortBy === "leads") return b._count.salesLeads - a._count.salesLeads;
    if (sortBy === "meetings") return b._count.meetingsAsSales - a._count.meetingsAsSales;
    if (sortBy === "won") return b.dealsWonCount - a.dealsWonCount;
    if (sortBy === "lost") return b.lostCount - a.lostCount;
    if (sortBy === "revenue") return b.revenue - a.revenue;
    return a.name.localeCompare(b.name);
  });

  // 3. Dynamic KPIs based strictly on the visible pool resulting from active filters
  const dTotalLeads = displayAgents.reduce((s, a) => s + (a._count?.salesLeads || 0), 0);
  const dDealsWon = displayAgents.reduce((s, a) => s + (a.dealsWonCount || 0), 0);
  const dDealsLost = displayAgents.reduce((s, a) => s + (a.lostCount || 0), 0);
  const dRevenue = displayAgents.reduce((s, a) => s + (a.revenue || 0), 0);

  const clearFilters = () => {
    setActiveCardFilter("All");
    setFilterSpec("All");
    setSortBy("name");
  };

  return (
    <div className="space-y-6">
      {/* KPI Summary Cards - Act as Filters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div
          onClick={() => setActiveCardFilter(activeCardFilter === "All" ? "All" : "All")}
          className={`cursor-pointer bg-gradient-to-br from-slate-600 to-slate-700 rounded-xl p-4 text-white shadow-lg transition-all hover:scale-[1.02] ${activeCardFilter === "All" ? "ring-4 ring-slate-300" : "opacity-80 hover:opacity-100"}`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 opacity-80" />
              <span className="text-xs font-semibold uppercase opacity-80">{t("metric.totalLeads")}</span>
            </div>
          </div>
          <p className="text-3xl font-bold">{dTotalLeads}</p>
        </div>
        <div
          onClick={() => setActiveCardFilter(activeCardFilter === "won" ? "All" : "won")}
          className={`cursor-pointer bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white shadow-lg transition-all hover:scale-[1.02] ${activeCardFilter === "won" ? "ring-4 ring-green-300" : "opacity-80 hover:opacity-100"}`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Handshake className="h-5 w-5 opacity-80" />
              <span className="text-xs font-semibold uppercase opacity-80">{t("metric.dealsWon")}</span>
            </div>
          </div>
          <p className="text-3xl font-bold">{dDealsWon}</p>
        </div>
        <div
          onClick={() => setActiveCardFilter(activeCardFilter === "lost" ? "All" : "lost")}
          className={`cursor-pointer bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-4 text-white shadow-lg transition-all hover:scale-[1.02] ${activeCardFilter === "lost" ? "ring-4 ring-red-300" : "opacity-80 hover:opacity-100"}`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 opacity-80" />
              <span className="text-xs font-semibold uppercase opacity-80">{t("metric.dealsLost")}</span>
            </div>
          </div>
          <p className="text-3xl font-bold">{dDealsLost}</p>
        </div>
        <div
          onClick={() => setActiveCardFilter(activeCardFilter === "revenue" ? "All" : "revenue")}
          className={`cursor-pointer bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-4 text-white shadow-lg transition-all hover:scale-[1.02] ${activeCardFilter === "revenue" ? "ring-4 ring-amber-300" : "opacity-80 hover:opacity-100"}`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 opacity-80" />
              <span className="text-xs font-semibold uppercase opacity-80">{t("finance.totalRevenue")}</span>
            </div>
          </div>
          <p className="text-3xl font-bold">{formatSarSuffix(dRevenue, { maximumFractionDigits: 0 })}</p>
        </div>
      </div>

      {/* Specialization Breakdown - clickable to filter */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div
          onClick={() => setFilterSpec("All")}
          className={`cursor-pointer bg-white rounded-xl border p-4 shadow-sm transition-all hover:border-slate-400 ${filterSpec === "All" ? "ring-2 ring-slate-400" : "border-gray-200"}`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 rounded-lg">
              <Users className="h-5 w-5 text-slate-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{agents.length}</p>
              <p className="text-xs text-gray-500">{t("metric.totalAgents")}</p>
            </div>
          </div>
        </div>
        <div
          onClick={() => setFilterSpec("Hot")}
          className={`cursor-pointer bg-white rounded-xl border p-4 shadow-sm transition-all hover:border-red-400 ${filterSpec === "Hot" ? "ring-2 ring-red-400" : "border-red-100"}`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-50 rounded-lg">
              <Flame className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{hotCount}</p>
              <p className="text-xs text-gray-500">{t("metric.hotAgents")}</p>
            </div>
          </div>
        </div>
        <div
          onClick={() => setFilterSpec("Warm")}
          className={`cursor-pointer bg-white rounded-xl border p-4 shadow-sm transition-all hover:border-amber-400 ${filterSpec === "Warm" ? "ring-2 ring-amber-400" : "border-amber-100"}`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-50 rounded-lg">
              <Sun className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600">{warmCount}</p>
              <p className="text-xs text-gray-500">{t("metric.warmAgents")}</p>
            </div>
          </div>
        </div>
        <div
          onClick={() => setFilterSpec("Cold")}
          className={`cursor-pointer bg-white rounded-xl border p-4 shadow-sm transition-all hover:border-blue-400 ${filterSpec === "Cold" ? "ring-2 ring-blue-400" : "border-blue-100"}`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Snowflake className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">{coldCount}</p>
              <p className="text-xs text-gray-500">{t("metric.coldAgents")}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Active Sort/Filter Indicator & Tags */}
      {(sortBy !== "name" || filterSpec !== "All" || activeCardFilter !== "All") && (
        <div className="flex items-center justify-between bg-white px-4 py-3 border border-gray-200 rounded-xl shadow-sm">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-gray-700 me-2">{t("filter.activeFilters")}</span>
            {activeCardFilter !== "All" && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 text-xs font-bold uppercase rounded border border-green-200">
                {activeCardFilter === "won" ? "Deals Won" : activeCardFilter === "lost" ? "Deals Lost" : "Revenue Gen"}
                <button onClick={() => setActiveCardFilter("All")} className="ms-1 opacity-60 hover:opacity-100 hover:text-red-500 transition">✕</button>
              </span>
            )}
            {filterSpec !== "All" && (
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold uppercase rounded border ${
                filterSpec === "Hot" ? "bg-red-50 text-red-700 border-red-200" :
                filterSpec === "Warm" ? "bg-amber-50 text-amber-700 border-amber-200" :
                "bg-blue-50 text-blue-700 border-blue-200"
              }`}>
                {filterSpec} Agents
                <button onClick={() => setFilterSpec("All")} className="ms-1 opacity-60 hover:opacity-100 hover:text-red-500 transition">✕</button>
              </span>
            )}
            {sortBy !== "name" && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-50 text-purple-700 text-xs font-bold uppercase rounded border border-purple-200">
                Sorted by: {sortBy === "leads" ? "Total Leads" : sortBy === "won" ? "Deals Won" : sortBy === "lost" ? "Deals Lost" : sortBy === "meetings" ? "Meetings" : "Revenue"} ↓
                <button onClick={() => setSortBy("name")} className="ms-1 opacity-60 hover:opacity-100 hover:text-red-500 transition">✕</button>
              </span>
            )}
          </div>
          <button onClick={clearFilters} className="text-xs font-bold text-gray-500 hover:text-red-600 transition underline underline-offset-2">
            Clear Filters
          </button>
        </div>
      )}

      {/* Agents Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">{t("common.agent")}</th>
                <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">{t("common.contact")}</th>
                <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">{t("common.level")}</th>
                <th
                  onClick={() => setSortBy(sortBy === "leads" ? "name" : "leads")}
                  className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 transition-colors"
                >
                  Leads {sortBy === "leads" ? "↓" : ""}
                </th>
                <th
                  onClick={() => setSortBy(sortBy === "meetings" ? "name" : "meetings")}
                  className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 transition-colors"
                >
                  Meetings (Today) {sortBy === "meetings" ? "↓" : ""}
                </th>
                <th
                  onClick={() => setSortBy(sortBy === "won" ? "name" : "won")}
                  className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 transition-colors"
                >
                  Closed Deals {sortBy === "won" ? "↓" : ""}
                </th>
                <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">{t("form.monthlyFundTarget")}</th>
                <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">{t("metric.winRate")}</th>
                <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">{t("common.status")}</th>
                <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">{t("common.specialization")}</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedAndFilteredAgents.map((agent) => {
                const SpecIcon = agent.specialization ? specIcons[agent.specialization] : null;
                return (
                  <tr key={agent.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white text-sm font-bold">
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
                      <span className="text-sm font-semibold text-gray-900">{agent._count.salesLeads}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-semibold text-blue-600">{agent._count.meetingsAsSales}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-semibold text-gray-900">{agent.dealsWonCount}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1.5">
                        {agent.target > 0 && (
                          <div
                            className="w-28 bg-gray-200 rounded-full h-1.5"
                            title={`This month: ${formatSarSuffix(agent.monthlyFund, { maximumFractionDigits: 0 })} / ${formatSarSuffix(agent.target, { maximumFractionDigits: 0 })}`}
                          >
                            <div
                              className={`h-1.5 rounded-full ${
                                (agent.monthlyFund / agent.target) >= 1 ? 'bg-green-500' :
                                (agent.monthlyFund / agent.target) >= 0.5 ? 'bg-yellow-400' : 'bg-red-400'
                              }`}
                              style={{ width: `${Math.min(100, (agent.monthlyFund / agent.target) * 100)}%` }}
                            />
                          </div>
                        )}
                        <span className="text-xs font-semibold text-gray-600">
                          {formatSarSuffix(agent.monthlyFund, { maximumFractionDigits: 0 })}
                        </span>
                        <input
                          type="number"
                          min={0}
                          defaultValue={agent.target}
                          onBlur={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            if (val !== agent.target) updateTarget(agent.id, val);
                          }}
                          className="w-24 border border-gray-200 rounded-md px-2 py-1 text-sm focus:ring-2 focus:ring-green-500"
                          title={t("form.fundTargetHint")}
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {agent.dealsWonCount + agent.lostCount > 0
                        ? `${Math.round((agent.dealsWonCount / (agent.dealsWonCount + agent.lostCount)) * 100)}%` 
                        : "0%"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        agent.status === "Active" ? "bg-green-100 text-green-800" :
                        agent.status === "In_Call" ? "bg-red-100 text-red-800" :
                        agent.status === "Busy" ? "bg-yellow-100 text-yellow-800" :
                        "bg-gray-100 text-gray-600"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full me-1.5 ${
                          agent.status === "Active" ? "bg-green-500" :
                          agent.status === "In_Call" ? "bg-red-500" :
                          agent.status === "Busy" ? "bg-yellow-500" :
                          "bg-gray-400"
                        }`} />
                        {agent.status.replace("_", " ")}
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
                        <option value="">{t("common.unassigned")}</option>
                        <option value="Hot">🔥 Hot</option>
                        <option value="Warm">☀️ Warm</option>
                        <option value="Cold">❄️ Cold</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
              {sortedAndFilteredAgents.length === 0 && (
                <tr><td colSpan={10} className="px-6 py-8 text-center text-sm text-gray-500">No agents found{filterSpec !== "All" ? ` with ${filterSpec} specialization` : " under your management"}.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
