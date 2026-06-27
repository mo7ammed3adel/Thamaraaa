export type TaskStatus = "pending" | "in_progress" | "review" | "done";

export type TaskPriority = "High" | "Medium" | "Low";

export type TaskChecklistItem = {
  id?: string;
  title?: string;
  text?: string;
  completed: boolean;
};

export type TaskFileEntry = {
  url: string;
  label?: string;
  type?: string;
  uploadedAt?: string;
};

export type TaskDto = {
  id: string;
  projectId: string;
  leaderId: string;
  agentId?: string | null;
  taskType: string;
  checklistItems: TaskChecklistItem[];
  progressPct: number;
  requesterRole?: string | null;
  assignedRole?: string | null;
  brief?: string | null;
  taskLink?: string | null;
  deadline?: string | null;
  priority: TaskPriority | string;
  status: TaskStatus | string;
  parentTaskId?: string | null;
  files?: TaskFileEntry[];
  startedAt?: string | null;
  flagReason?: string | null;
  flaggedAt?: string | null;
  flaggedByUserId?: string | null;
  createdAt: string;
  completedAt?: string | null;
};
