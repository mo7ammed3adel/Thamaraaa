"use client";

import { useState } from "react";
import { useTranslator } from "@/components/i18n/LocaleProvider";

interface PipelineStage {
  key: string;
  label: string;
  color: string;
  borderColor: string;
  bgColor: string;
}

const PIPELINE_STAGES: PipelineStage[] = [
  { key: "new", label: "New Leads", color: "bg-blue-500", borderColor: "border-blue-200", bgColor: "bg-blue-50" },
  { key: "setup", label: "In Sales", color: "bg-purple-500", borderColor: "border-purple-200", bgColor: "bg-purple-50" },
  { key: "assigned", label: "Assigned", color: "bg-amber-500", borderColor: "border-amber-200", bgColor: "bg-amber-50" },
  { key: "in_progress", label: "In Progress", color: "bg-orange-500", borderColor: "border-orange-200", bgColor: "bg-orange-50" },
  { key: "completed", label: "Completed", color: "bg-emerald-500", borderColor: "border-emerald-200", bgColor: "bg-emerald-50" },
];

const DEAL_STAGES: PipelineStage[] = [
  { key: "Pending", label: "Pending Deals", color: "bg-amber-500", borderColor: "border-amber-200", bgColor: "bg-amber-50" },
  { key: "Approved", label: "Approved Deals", color: "bg-emerald-500", borderColor: "border-emerald-200", bgColor: "bg-emerald-50" },
];

/**
 * Client component for the Chief Sales Pipeline view.
 * Provides Kanban and Table views for projects and deals.
 */
export default function PipelineClient({ deals, projects }: any) {
  const t = useTranslator();
  const [view, setView] = useState<"kanban" | "table">("kanban");
  const [pipelineType, setPipelineType] = useState<"projects" | "deals">("projects");

  /**
   * Groups projects by their projectStatus for the Kanban board.
   */
  function getProjectsByStage(stageKey: string) {
    return projects.filter((p: any) => p.projectStatus === stageKey);
  }

  /**
   * Groups deals by their status for the Kanban board.
   */
  function getDealsByStage(stageKey: string) {
    return deals.filter((d: any) => d.status === stageKey);
  }

  const stages = pipelineType === "projects" ? PIPELINE_STAGES : DEAL_STAGES;

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => setPipelineType("projects")}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition ${pipelineType === "projects" ? "bg-white shadow text-slate-700" : "text-slate-500 hover:text-slate-700"}`}
          >
            Projects Pipeline
          </button>
          <button
            onClick={() => setPipelineType("deals")}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition ${pipelineType === "deals" ? "bg-white shadow text-slate-700" : "text-slate-500 hover:text-slate-700"}`}
          >
            Deals Pipeline
          </button>
        </div>

        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => setView("kanban")}
            className={`px-3 py-1 text-xs font-medium rounded-md transition ${view === "kanban" ? "bg-white shadow text-slate-700" : "text-slate-500"}`}
          >
            Kanban
          </button>
          <button
            onClick={() => setView("table")}
            className={`px-3 py-1 text-xs font-medium rounded-md transition ${view === "table" ? "bg-white shadow text-slate-700" : "text-slate-500"}`}
          >
            Table
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {stages.map((stage) => {
          const items = pipelineType === "projects" ? getProjectsByStage(stage.key) : getDealsByStage(stage.key);
          const value = pipelineType === "deals"
            ? items.reduce((s: number, d: any) => s + (d.totalAmount || 0), 0)
            : items.length;
          return (
            <div key={stage.key} className={`${stage.bgColor} p-4 rounded-xl border ${stage.borderColor} text-center`}>
              <p className="text-xs font-medium text-slate-600">{stage.label}</p>
              <p className="text-2xl font-bold text-slate-800">
                {pipelineType === "deals" ? `${value.toLocaleString()} SAR` : value}
              </p>
            </div>
          );
        })}
      </div>

      {/* Kanban View */}
      {view === "kanban" && (
        <div className={`grid gap-4`} style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))` }}>
          {stages.map((stage) => {
            const items = pipelineType === "projects" ? getProjectsByStage(stage.key) : getDealsByStage(stage.key);
            return (
              <div key={stage.key} className={`${stage.bgColor} rounded-xl p-4 border ${stage.borderColor}`}>
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${stage.color}`} />
                  <h3 className="text-sm font-bold text-slate-700">{stage.label}</h3>
                  <span className="ms-auto text-xs font-medium text-slate-400 bg-white px-2 py-0.5 rounded-full">
                    {items.length}
                  </span>
                </div>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {items.map((item: any) => (
                    <div key={item.id} className="bg-white rounded-lg p-3 border shadow-sm hover:shadow-md transition">
                      {pipelineType === "projects" ? (
                        <>
                          <p className="text-sm font-semibold text-slate-800">{item.deal?.lead?.name || "Unknown"}</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {item.package} • {item.deal?.totalAmount?.toLocaleString()} SAR
                          </p>
                          {item.accountManager && (
                            <p className="text-xs text-indigo-600 mt-1">AM: {item.accountManager.name}</p>
                          )}
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-semibold text-slate-800">{item.lead?.name || "Unknown"}</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {item.package} • {item.totalAmount?.toLocaleString()} SAR
                          </p>
                          {item.salesAgent && (
                            <p className="text-xs text-purple-600 mt-1">Agent: {item.salesAgent.name}</p>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                  {items.length === 0 && (
                    <p className="text-xs text-slate-400 italic text-center py-4">{t("chief.noItems")}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Table View */}
      {view === "table" && (
        <div className="bg-white rounded-xl shadow border overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-start text-xs font-semibold text-slate-500 uppercase">{t("common.client")}</th>
                <th className="px-6 py-3 text-start text-xs font-semibold text-slate-500 uppercase">{t("common.package")}</th>
                <th className="px-6 py-3 text-start text-xs font-semibold text-slate-500 uppercase">
                  {pipelineType === "projects" ? "Account Manager" : "Sales Agent"}
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase">{t("common.amount")}</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase">{t("common.status")}</th>
                <th className="px-6 py-3 text-end text-xs font-semibold text-slate-500 uppercase">{t("common.date")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(pipelineType === "projects" ? projects : deals).map((item: any) => (
                <tr key={item.id} className="hover:bg-slate-50/50 transition">
                  <td className="px-6 py-4 text-sm font-bold text-slate-900">
                    {pipelineType === "projects" ? item.deal?.lead?.name : item.lead?.name}
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                      {item.package}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {pipelineType === "projects"
                      ? item.accountManager?.name || "N/A"
                      : item.salesAgent?.name || "N/A"}
                  </td>
                  <td className="px-6 py-4 text-sm text-center font-medium text-emerald-700">
                    {(pipelineType === "projects"
                      ? item.deal?.totalAmount
                      : item.totalAmount
                    )?.toLocaleString()}{" "}
                    SAR
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="px-2 py-1 text-xs rounded-full font-semibold bg-slate-100 text-slate-700 capitalize">
                      {(pipelineType === "projects" ? item.projectStatus : item.status)?.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-end text-slate-500">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
