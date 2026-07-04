import type { TaskDto } from "./task";

export type ProjectStatus =
  | "new"
  | "setup"
  | "assigned"
  | "in_progress"
  | "completed"
  | "on_hold"
  | "delayed"
  | "cancelled";

export type ProjectLifecycleState = "Active" | "Hold" | "Renewer" | "Lost";

export type TeamAssignmentDto = {
  id: string;
  projectId: string;
  userId: string;
  assignedByUserId: string;
  role: string;
  department: string;
  status: string;
  assignedAt: string;
  removedAt?: string | null;
};

export type ProjectFileDto = {
  id: string;
  projectId: string;
  fileUrl: string;
  fileType: string;
  uploadedBy: string;
  createdAt: string;
};

export type ProjectLogDto = {
  id: string;
  projectId: string;
  action: string;
  details?: string | null;
  userId: string;
  createdAt: string;
};

export type ProjectDto = {
  id: string;
  dealId: string;
  accountManagerId?: string | null;
  headTechnicalId?: string | null;
  headSeoId?: string | null;
  niche?: string | null;
  package: string;
  packageId?: string | null;
  technicalDeadline?: string | null;
  addedDurationDays: number;
  finalDeadline?: string | null;
  seoProgress: number;
  socialMediaProgress: number;
  mediaBuyerProgress: number;
  storeCreated: boolean;
  userCreatedStore: boolean;
  storeUrl?: string | null;
  driveLink?: string | null;
  screenshotUrl?: string | null;
  priority?: string | null;
  finalStatus: string;
  projectStatus: ProjectStatus | string;
  lifecycleState: ProjectLifecycleState | string;
  assignedAt?: string | null;
  notes?: string | null;
  createdAt: string;
  tasks?: TaskDto[];
  files?: ProjectFileDto[];
  logs?: ProjectLogDto[];
  teamAssignments?: TeamAssignmentDto[];
};
