"use client";

import { AlertTriangle, Briefcase, CheckCircle, Clock, ListTodo, PauseCircle, RefreshCw, UserX, Users } from "lucide-react";
import { LIFECYCLE_STATE, getLifecycleLabelAr } from "@/lib/constants";

type AccountManagerKpis = {
  activeClients: number;
  clientsWithWarnings: number;
  tasksInProgress: number;
  tasksDelayed: number;
  tasksDoneThisWeek: number;
};

type AccountManagerKpiGridProps = {
  kpis: AccountManagerKpis;
  activeKpi: string;
  setActiveKpi: (value: string) => void;
  /** Client count per lifecycle state, keyed by the raw state value. */
  lifecycleCounts: Record<string, number>;
  /** Currently selected lifecycle filter ("all" when none). */
  filterLifecycle: string;
  setFilterLifecycle: (value: string) => void;
};

/** One tile per lifecycle state, in the order a client moves through them. */
const LIFECYCLE_TILES = [
  { state: LIFECYCLE_STATE.ACTIVE, Icon: Users, accent: "text-emerald-500", ring: "border-emerald-500 bg-emerald-50" },
  { state: LIFECYCLE_STATE.HOLD, Icon: PauseCircle, accent: "text-amber-500", ring: "border-amber-500 bg-amber-50" },
  { state: LIFECYCLE_STATE.RENEWER, Icon: RefreshCw, accent: "text-blue-500", ring: "border-blue-500 bg-blue-50" },
  { state: LIFECYCLE_STATE.LOST, Icon: UserX, accent: "text-red-500", ring: "border-red-500 bg-red-50" },
];

export default function AccountManagerKpiGrid({
  kpis,
  activeKpi,
  setActiveKpi,
  lifecycleCounts,
  filterLifecycle,
  setFilterLifecycle,
}: AccountManagerKpiGridProps) {
  return (
    <div className="space-y-4">
      {/* ── Client status tiles: each one toggles the lifecycle filter ── */}
      <div>
        <p className="text-xs font-bold uppercase text-slate-500 mb-2">Client Status</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {LIFECYCLE_TILES.map(({ state, Icon, accent, ring }) => {
            const isActive = filterLifecycle === state;
            return (
              <button
                key={state}
                onClick={() => setFilterLifecycle(isActive ? "all" : state)}
                title={state}
                className={`p-4 rounded-xl border-2 text-left transition cursor-pointer flex flex-col justify-between ${
                  isActive ? ring : "border-transparent bg-white hover:bg-gray-50 shadow-sm"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`w-5 h-5 ${accent}`} />
                  <span className="text-[11px] font-bold uppercase text-gray-500">{getLifecycleLabelAr(state)}</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{lifecycleCounts[state] ?? 0}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Operational KPIs: each one filters the client and task lists ── */}
      <div>
        <p className="text-xs font-bold uppercase text-slate-500 mb-2">Operations</p>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <button onClick={() => setActiveKpi(activeKpi === "active_clients" ? "all" : "active_clients")} className={`p-4 rounded-xl border-2 text-left transition cursor-pointer ${activeKpi === "active_clients" ? "border-blue-500 bg-blue-50" : "border-transparent bg-white hover:bg-gray-50 shadow-sm"} flex flex-col justify-between`}>
          <div className="flex items-center gap-2 mb-2">
            <Briefcase className="w-5 h-5 text-blue-500" />
            <span className="text-[11px] font-bold uppercase text-gray-500">Active Clients</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{kpis.activeClients}</p>
        </button>

        <button onClick={() => setActiveKpi(activeKpi === "warning_clients" ? "all" : "warning_clients")} className={`p-4 rounded-xl border-2 text-left transition cursor-pointer ${activeKpi === "warning_clients" ? "border-red-500 bg-red-50" : "border-transparent bg-white hover:bg-gray-50 shadow-sm"} flex flex-col justify-between`}>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <span className="text-[11px] font-bold uppercase text-gray-500">Clients w/ Warnings</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{kpis.clientsWithWarnings}</p>
        </button>

        <button onClick={() => setActiveKpi(activeKpi === "tasks_in_progress" ? "all" : "tasks_in_progress")} className={`p-4 rounded-xl border-2 text-left transition cursor-pointer ${activeKpi === "tasks_in_progress" ? "border-amber-500 bg-amber-50" : "border-transparent bg-white hover:bg-gray-50 shadow-sm"} flex flex-col justify-between`}>
          <div className="flex items-center gap-2 mb-2">
            <ListTodo className="w-5 h-5 text-amber-500" />
            <span className="text-[11px] font-bold uppercase text-gray-500">Tasks In Progress</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{kpis.tasksInProgress}</p>
        </button>

        <button onClick={() => setActiveKpi(activeKpi === "tasks_delayed" ? "all" : "tasks_delayed")} className={`p-4 rounded-xl border-2 text-left transition cursor-pointer ${activeKpi === "tasks_delayed" ? "border-red-500 bg-red-50" : "border-transparent bg-white hover:bg-gray-50 shadow-sm"} flex flex-col justify-between`}>
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-red-500" />
            <span className="text-[11px] font-bold uppercase text-gray-500">Delayed Tasks</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{kpis.tasksDelayed}</p>
        </button>

        <button onClick={() => setActiveKpi(activeKpi === "tasks_done" ? "all" : "tasks_done")} className={`p-4 rounded-xl border-2 text-left transition cursor-pointer ${activeKpi === "tasks_done" ? "border-emerald-500 bg-emerald-50" : "border-transparent bg-white hover:bg-gray-50 shadow-sm"} flex flex-col justify-between`}>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-5 h-5 text-emerald-500" />
            <span className="text-[11px] font-bold uppercase text-gray-500">Tasks Done This Week</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{kpis.tasksDoneThisWeek}</p>
        </button>
        </div>
      </div>
    </div>
  );
}
