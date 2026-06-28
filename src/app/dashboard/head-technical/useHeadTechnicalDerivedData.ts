"use client";

import { useMemo } from "react";

export const TECHNICAL_TASK_TO_DEPARTMENT: Record<string, string> = {
  Social_Media: "social_media",
  social_media: "social_media",
  Media_Buyer: "media_buyer",
  media_buyer: "media_buyer",
  media_buying: "media_buyer",
};

type UseHeadTechnicalDerivedDataParams = {
  projects: any[];
  allTasks: any[];
  activeKpi: string;
  searchQuery: string;
  taskFilter: string;
};

export function isHeadTechnicalTask(task: any) {
  return Boolean(TECHNICAL_TASK_TO_DEPARTMENT[task.taskType]);
}

function hasDepartmentLeader(project: any, department: string) {
  const hasAssignmentLeader = (project.teamAssignments || []).some((assignment: any) =>
    assignment.department === department &&
    assignment.role.includes("leader")
  );
  const hasTaskLeader = (project.tasks || []).some((task: any) =>
    TECHNICAL_TASK_TO_DEPARTMENT[task.taskType] === department &&
    Boolean(task.leaderId)
  );
  return hasAssignmentLeader || hasTaskLeader;
}

export function getMissingTechnicalDepartments(project: any) {
  return (project.requiredTechnicalDepartments || []).filter((department: string) => !hasDepartmentLeader(project, department));
}

export function getDelayedTechnicalTasks(project: any) {
  return (project.tasks || []).filter((task: any) =>
    isHeadTechnicalTask(task) &&
    task.status !== "done" &&
    task.deadline &&
    new Date(task.deadline) < new Date()
  );
}

export function getDepartmentSummary(project: any, department: string) {
  const assignments = (project.teamAssignments || []).filter((assignment: any) => assignment.department === department);
  const tasks = (project.tasks || []).filter((task: any) => TECHNICAL_TASK_TO_DEPARTMENT[task.taskType] === department);
  const leader = assignments.find((assignment: any) => assignment.role.includes("leader"))?.user || tasks.find((task: any) => task.leader)?.leader || null;
  const agentIds = new Set<string>();

  assignments
    .filter((assignment: any) => assignment.role.includes("agent"))
    .forEach((assignment: any) => agentIds.add(assignment.userId));
  tasks
    .filter((task: any) => task.agentId)
    .forEach((task: any) => agentIds.add(task.agentId));

  return {
    department,
    leader,
    agentCount: agentIds.size,
    hasDelayedTasks: tasks.some((task: any) => task.status !== "done" && task.deadline && new Date(task.deadline) < new Date()),
  };
}

export function getHeadTechnicalDepartmentsToShow(project: any) {
  return Array.from(new Set([
    ...(project.requiredTechnicalDepartments || []),
    ...(project.teamAssignments || [])
      .filter((assignment: any) => ["social_media", "media_buyer"].includes(assignment.department))
      .map((assignment: any) => assignment.department),
    ...(project.tasks || [])
      .map((task: any) => TECHNICAL_TASK_TO_DEPARTMENT[task.taskType])
      .filter(Boolean),
  ]));
}

export function getHeadTechnicalProgressColor(val: number) {
  return val < 30 ? "bg-red-500" : val < 70 ? "bg-amber-400" : "bg-emerald-500";
}

function matchesProjectSearch(project: any, searchQuery: string) {
  return !searchQuery ||
    project.deal?.lead?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    project.deal?.lead?.phone?.includes(searchQuery) ||
    project.package?.toLowerCase().includes(searchQuery.toLowerCase());
}

function matchesActiveKpi(project: any, activeKpi: string) {
  if (activeKpi === "unassigned") return getMissingTechnicalDepartments(project).length > 0;
  if (activeKpi === "active") return ["in_progress", "setup", "assigned"].includes(project.projectStatus);
  if (activeKpi === "delayed") return project.projectStatus === "delayed" || getDelayedTechnicalTasks(project).length > 0;
  if (activeKpi === "in_progress") return project.tasks?.some((task: any) => isHeadTechnicalTask(task) && ["pending", "in_progress"].includes(task.status));
  if (activeKpi === "warnings") return (project.warnings || []).length > 0;
  return true;
}

function matchesTaskFilter(task: any, taskFilter: string) {
  if (taskFilter === "all") return true;
  if (taskFilter === "delayed") return task.status !== "done" && task.deadline && new Date(task.deadline) < new Date();
  return task.status === taskFilter;
}

export function useHeadTechnicalDerivedData({
  projects,
  allTasks,
  activeKpi,
  searchQuery,
  taskFilter,
}: UseHeadTechnicalDerivedDataParams) {
  const filteredProjects = useMemo(() => {
    return projects.filter((project: any) => matchesProjectSearch(project, searchQuery) && matchesActiveKpi(project, activeKpi));
  }, [projects, searchQuery, activeKpi]);

  const visibleTasks = useMemo(() => {
    return (allTasks || [])
      .filter((task: any) => matchesTaskFilter(task, taskFilter))
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [allTasks, taskFilter]);

  return {
    filteredProjects,
    hasActiveFilters: Boolean(searchQuery || activeKpi !== "all"),
    visibleTasks,
  };
}
