"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import HeadTechnicalClientsTable from "./HeadTechnicalClientsTable";
import HeadTechnicalKpiGrid from "./HeadTechnicalKpiGrid";
import HeadTechnicalTasksPanel from "./HeadTechnicalTasksPanel";
import HeadTechnicalWorkload from "./HeadTechnicalWorkload";
import { useHeadTechnicalDerivedData } from "./useHeadTechnicalDerivedData";

export default function HeadTechnicalClient({ projects, teamLeaders, kpis, userId }: any) {
  const router = useRouter();
  const [taskFilter, setTaskFilter] = useState("all");
  const [activeKpi, setActiveKpi] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const { filteredProjects, hasActiveFilters, visibleTasks } = useHeadTechnicalDerivedData({
    projects,
    allTasks: kpis.allTasks,
    activeKpi,
    searchQuery,
    taskFilter,
  });

  const clearAllFilters = () => {
    setSearchQuery("");
    setActiveKpi("all");
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <HeadTechnicalKpiGrid kpis={kpis} activeKpi={activeKpi} setActiveKpi={setActiveKpi} />

      {/* Team Leaders Workload */}
      <HeadTechnicalWorkload teamLeaders={teamLeaders} />

      {/* Projects Table */}
      <HeadTechnicalClientsTable
        projects={projects}
        filteredProjects={filteredProjects}
        hasActiveFilters={hasActiveFilters}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        clearAllFilters={clearAllFilters}
        openClientTeam={(projectId) => router.push(`/dashboard/clients/${projectId}?tab=team`)}
        openClientJourney={(projectId) => router.push(`/dashboard/clients/${projectId}`)}
      />

      {/* Tasks Overview (Global) */}
      <HeadTechnicalTasksPanel
        allTasks={kpis.allTasks}
        visibleTasks={visibleTasks}
        projects={projects}
        taskFilter={taskFilter}
        setTaskFilter={setTaskFilter}
      />
    </div>
  );
}
