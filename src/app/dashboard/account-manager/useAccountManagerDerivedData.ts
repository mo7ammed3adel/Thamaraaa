"use client";

import { useMemo } from "react";

type UseAccountManagerDerivedDataParams = {
  projects: any[];
  searchQuery: string;
  activeKpi: string;
  taskFilterClient: string;
  taskFilterStatus: string;
  taskFilterTeam: string;
};

export function useAccountManagerDerivedData({
  projects,
  searchQuery,
  activeKpi,
  taskFilterClient,
  taskFilterStatus,
  taskFilterTeam,
}: UseAccountManagerDerivedDataParams) {
  const filteredProjects = useMemo(() => {
    return projects.filter((p: any) => {
      const matchSearch = !searchQuery || (p.deal?.lead?.name?.toLowerCase().includes(searchQuery.toLowerCase()) || p.deal?.lead?.phone?.includes(searchQuery));
      let matchKpi = true;
      if (activeKpi === "active_clients") {
        matchKpi = ["in_progress", "setup"].includes(p.projectStatus);
      } else if (activeKpi === "warning_clients") {
        matchKpi = p.warnings && p.warnings.length > 0;
      } else if (activeKpi === "tasks_in_progress") {
        matchKpi = (p.tasks || []).some((t: any) => t.status === "in_progress");
      } else if (activeKpi === "tasks_delayed") {
        const now = new Date();
        matchKpi = (p.tasks || []).some((t: any) => t.deadline && new Date(t.deadline) < now && t.status !== "done");
      } else if (activeKpi === "tasks_done") {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        matchKpi = (p.tasks || []).some((t: any) => t.status === "done" && t.completedAt && new Date(t.completedAt) > oneWeekAgo);
      }
      return matchSearch && matchKpi;
    });
  }, [projects, searchQuery, activeKpi]);

  const filteredTasks = useMemo(() => {
    let allTasks = projects.flatMap((p: any) => (p.tasks || []).map((t: any) => ({ ...t, project: p })));

    if (taskFilterClient) allTasks = allTasks.filter((t: any) => t.projectId === taskFilterClient);
    if (taskFilterStatus) allTasks = allTasks.filter((t: any) => t.status === taskFilterStatus);
    if (taskFilterTeam) allTasks = allTasks.filter((t: any) => t.taskType === taskFilterTeam);

    if (activeKpi === "tasks_in_progress") {
      allTasks = allTasks.filter((t: any) => t.status === "in_progress");
    } else if (activeKpi === "tasks_delayed") {
      const now = new Date();
      allTasks = allTasks.filter((t: any) => t.deadline && new Date(t.deadline) < now && t.status !== "done");
    } else if (activeKpi === "tasks_done") {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      allTasks = allTasks.filter((t: any) => t.status === "done" && t.completedAt && new Date(t.completedAt) > oneWeekAgo);
    }

    return allTasks.sort((a: any, b: any) => {
      if (a.status !== "done" && b.status === "done") return -1;
      if (a.status === "done" && b.status !== "done") return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [projects, taskFilterClient, taskFilterStatus, taskFilterTeam, activeKpi]);

  return { filteredProjects, filteredTasks };
}
