"use client";

import { useMemo } from "react";

type UseHeadAccountManagerDerivedDataParams = {
  projects: any[];
  filterAM: string;
  searchQuery: string;
  filterStatus: string;
  filterWarning: string;
  filterDelay: string;
  activeKpi: string;
  filterLifecycle: string;
};

export function useHeadAccountManagerDerivedData({
  projects,
  filterAM,
  searchQuery,
  filterStatus,
  filterWarning,
  filterDelay,
  activeKpi,
  filterLifecycle,
}: UseHeadAccountManagerDerivedDataParams) {
  const allTasks = useMemo(() => projects.flatMap((p: any) => p.tasks || []), [projects]);

  const filteredProjects = useMemo(() => {
    return projects.filter((p: any) => {
      const matchesAM = filterAM === "all" ? true : filterAM === "unassigned" ? !p.accountManagerId : p.accountManagerId === filterAM;
      const matchesSearch = !searchQuery || (p.deal?.lead?.name?.toLowerCase().includes(searchQuery.toLowerCase()) || p.deal?.lead?.phone?.includes(searchQuery));
      const matchesStatus = filterStatus === "all" ? true : p.projectStatus === filterStatus;
      const hasWarnings = p.warnings && p.warnings.length > 0;
      const matchesWarning = filterWarning === "all" ? true : filterWarning === "yes" ? hasWarnings : filterWarning === "no" ? !hasWarnings : true;

      const isDelayed = p.projectStatus === "delayed" || (p.tasks && p.tasks.some((t:any) => t.status !== "done" && t.deadline && new Date(t.deadline) < new Date()));
      const matchesDelay = filterDelay === "all" ? true : filterDelay === "yes" ? isDelayed : true;

      let matchesKpi = true;
      if (activeKpi === "newToday") {
         const today = new Date().toLocaleDateString();
         matchesKpi = new Date(p.createdAt).toLocaleDateString() === today;
      } else if (activeKpi === "active") {
         matchesKpi = ["in_progress", "setup", "assigned"].includes(p.projectStatus);
      } else if (activeKpi === "unassigned") {
         matchesKpi = !p.accountManagerId;
      } else if (activeKpi === "delayed") {
         matchesKpi = isDelayed;
      } else if (activeKpi === "completed") {
         matchesKpi = p.projectStatus === "completed";
      } else if (activeKpi === "warnings") {
         matchesKpi = hasWarnings;
      }

      const matchesLifecycle = filterLifecycle === "all" ? true : p.lifecycleState === filterLifecycle;

      return matchesAM && matchesSearch && matchesStatus && matchesWarning && matchesDelay && matchesKpi && matchesLifecycle;
    });
  }, [projects, filterAM, searchQuery, filterStatus, filterWarning, filterDelay, activeKpi, filterLifecycle]);

  return { allTasks, filteredProjects };
}
