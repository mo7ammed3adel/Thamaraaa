import { canChangeLifecycle, validateLifecycleTransition } from "@/lib/lifecycle";
import { safeTrigger } from "@/lib/pusher";
import { backfillReceiptsForNewMember, checkProjectBlockers, userCanAccessProject } from "@/lib/distribution";
import { normalizeWebUrl } from "@/lib/safe-url";
import { notifyHeadAccountManagersOfNewProject } from "@/lib/projectSetup";
import {
  createProjectAssignmentNotification,
  createProjectFile,
  createProjectLog,
  createProjectFromDealWithLog,
  findActiveAccountManager,
  findActiveHeadAccountManagerCandidate,
  findDealForProjectSetup,
  findProjectAccountManagerId,
  findProjectByDealId,
  findProjectDetailFull,
  findProjectFiles,
  findProjectLifecycleAuth,
  findProjectLogs,
  findProjectSetupAuth,
  findProjectStatusAuth,
  updateProjectFields,
  updateProjectHeadAccountManager,
  updateProjectLifecycleWithLog,
} from "@/server/repositories/projectRepository";

export async function changeProjectLifecycle(input: {
  projectId: string;
  newState: string;
  userId: string;
  userRole: string;
  userName: string;
}) {
  const project = await findProjectLifecycleAuth(input.projectId);
  if (!project) return { status: "not_found" as const };

  if (!canChangeLifecycle(input.userRole, input.userId, project.accountManagerId)) {
    return { status: "forbidden" as const };
  }

  const validation = validateLifecycleTransition(project.lifecycleState, input.newState);
  if (!validation.valid) {
    return { status: "invalid_transition" as const, error: validation.error };
  }

  const [updatedProject] = await updateProjectLifecycleWithLog({
    projectId: input.projectId,
    fromState: project.lifecycleState,
    toState: input.newState,
    userId: input.userId,
    userName: input.userName,
    userRole: input.userRole,
  });

  await safeTrigger("projects-channel", "lifecycle-changed", {
    projectId: input.projectId,
    newState: input.newState,
    changedBy: input.userName,
  });

  return { status: "ok" as const, project: updatedProject };
}

export async function setupExistingProject(input: {
  projectId: string;
  userId: string;
  userRole: string;
  body: any;
}) {
  if (!input.projectId) return { status: "missing_project_id" as const };

  if (!["super_admin", "head_account_manager", "account_manager"].includes(input.userRole)) {
    return { status: "forbidden" as const };
  }

  if (input.userRole === "account_manager") {
    const project = await findProjectSetupAuth(input.projectId);
    if (!project || project.accountManagerId !== input.userId) {
      return { status: "not_your_project" as const };
    }
  }

  const { niche, storeUrl, driveLink, technicalDeadline, finalDeadline, notes, projectStatus } =
    input.body;

  const safeStoreUrl = storeUrl ? normalizeWebUrl(storeUrl) : null;
  const safeDriveLink = driveLink ? normalizeWebUrl(driveLink) : null;
  if ((storeUrl && !safeStoreUrl) || (driveLink && !safeDriveLink)) {
    return { status: "invalid_links" as const };
  }

  const updateData: Record<string, unknown> = {};
  if (niche !== undefined) updateData.niche = niche;
  if (storeUrl !== undefined) updateData.storeUrl = safeStoreUrl;
  if (driveLink !== undefined) updateData.driveLink = safeDriveLink;
  if (technicalDeadline !== undefined) {
    updateData.technicalDeadline = technicalDeadline ? new Date(technicalDeadline) : null;
  }
  if (finalDeadline !== undefined) {
    updateData.finalDeadline = finalDeadline ? new Date(finalDeadline) : null;
  }
  if (notes !== undefined) updateData.notes = notes;
  if (projectStatus !== undefined) {
    if (projectStatus !== "setup") {
      return { status: "invalid_setup_status" as const };
    }
    updateData.projectStatus = "setup";
  }

  const project = await updateProjectFields(input.projectId, updateData);

  await createProjectLog({
    projectId: input.projectId,
    action: "project_setup",
    details: `Initial setup completed by Account Manager. Technical Deadline: ${
      technicalDeadline ? new Date(technicalDeadline).toLocaleDateString() : "None"
    }, Final Deadline: ${finalDeadline ? new Date(finalDeadline).toLocaleDateString() : "None"}`,
    userId: input.userId,
  });

  return { status: "ok" as const, project };
}

export async function createProjectSetupFromDeal(input: {
  userId: string;
  userRole?: string | null;
  body: any;
}) {
  if (!["sales_agent", "super_admin"].includes(input.userRole || "")) {
    return { status: "forbidden" as const };
  }

  const { dealId, niche, deadline } = input.body;
  if (!dealId) return { status: "missing_deal_id" as const };

  const existingProject = await findProjectByDealId(dealId);
  if (existingProject) {
    return { status: "duplicate" as const, project: existingProject };
  }

  const dealData = await findDealForProjectSetup(dealId);
  if (!dealData) return { status: "deal_not_found" as const };

  if (input.userRole === "sales_agent" && dealData.salesAgentId !== input.userId) {
    return { status: "deal_forbidden" as const };
  }

  const packageName = dealData.package;
  const clientName = dealData.lead?.name || "Unknown Client";

  const project = await createProjectFromDealWithLog({
    deal: dealData,
    niche: niche || null,
    deadline: deadline ? new Date(deadline) : null,
    packageName,
    userId: input.userId,
  });

  await notifyHeadAccountManagersOfNewProject(clientName, packageName);

  return { status: "ok" as const, project };
}

const VALID_PROJECT_STATUSES = [
  "new",
  "setup",
  "assigned",
  "in_progress",
  "on_hold",
  "delayed",
  "completed",
  "cancelled",
];

export async function updateProjectStatus(input: {
  projectId: string;
  userId: string;
  userRole: string;
  userName?: string | null;
  body: any;
}) {
  const project = await findProjectStatusAuth(input.projectId);
  if (!project) return { status: "not_found" as const };

  const isOwner = project.accountManagerId === input.userId;
  const isAdmin = ["super_admin", "head_account_manager"].includes(input.userRole);
  const isAssignedHeadTechnical =
    input.userRole === "head_technical" && project.headTechnicalId === input.userId;

  if (!isOwner && !isAdmin && !isAssignedHeadTechnical) {
    return { status: "forbidden" as const };
  }

  const { projectStatus, finalStatus, notes, details, accountManagerId } = input.body;

  if (projectStatus && !VALID_PROJECT_STATUSES.includes(projectStatus)) {
    return { status: "invalid_status" as const, projectStatus };
  }

  if (accountManagerId !== undefined) {
    if (!["super_admin", "head_account_manager"].includes(input.userRole)) {
      return { status: "account_manager_forbidden" as const };
    }

    if (accountManagerId) {
      const targetAccountManager = await findActiveAccountManager(accountManagerId);
      if (
        !targetAccountManager ||
        targetAccountManager.role !== "account_manager" ||
        targetAccountManager.status !== "Active"
      ) {
        return { status: "target_account_manager_invalid" as const };
      }
    }
  }

  const updateData: Record<string, unknown> = {};
  if (projectStatus) updateData.projectStatus = projectStatus;
  if (finalStatus) updateData.finalStatus = finalStatus;
  if (notes !== undefined) updateData.notes = notes;
  if (accountManagerId !== undefined) updateData.accountManagerId = accountManagerId || null;

  if (projectStatus && ["in_progress", "completed", "review"].includes(projectStatus)) {
    const blockers = await checkProjectBlockers(input.projectId);
    if (blockers.isBlocked) {
      return { status: "blocked" as const, warnings: blockers.warnings };
    }
  }

  const updatedProject = await updateProjectFields(input.projectId, updateData);

  if (projectStatus || finalStatus) {
    await createProjectLog({
      projectId: input.projectId,
      action: "status_changed",
      details: details || `Status changed to ${projectStatus || finalStatus} by ${input.userName || input.userId}`,
      userId: input.userId,
    });
  }

  if (accountManagerId !== undefined && project.accountManagerId !== (accountManagerId || null)) {
    await createProjectLog({
      projectId: input.projectId,
      action: "account_manager_changed",
      details:
        details ||
        `Account Manager ${accountManagerId ? "assigned" : "unassigned"} by ${
          input.userName || input.userId
        }`,
      userId: input.userId,
    });

    if (accountManagerId) {
      await backfillReceiptsForNewMember(input.projectId, accountManagerId);
    }
  }

  return { status: "ok" as const, project: updatedProject };
}

// ── Project detail: logs, files, 360° view, allow-listed edits, head AM ──

// Fields the project detail edit is allowed to mutate. Anything not in this list
// is silently dropped to prevent mass-assignment attacks (e.g. overwriting accountManagerId,
// totals, lifecycleState — those have dedicated endpoints with stricter authz).
const ALLOWED_PROJECT_PATCH_FIELDS = new Set([
  "niche",
  "storeUrl",
  "driveLink",
  "screenshotUrl",
  "notes",
  "priority",
  "technicalDeadline",
  "finalDeadline",
  "addedDurationDays",
  "storeCreated",
  "userCreatedStore",
]);

const PROJECT_DATE_FIELDS = new Set(["technicalDeadline", "finalDeadline"]);
const PROJECT_URL_FIELDS = new Set(["storeUrl", "driveLink", "screenshotUrl"]);

export async function listProjectLogs(input: { userId: string; userRole: string; projectId: string }) {
  const allowed = await userCanAccessProject(input.userId, input.userRole, input.projectId);
  if (!allowed) return { status: "forbidden" as const };

  const logs = await findProjectLogs(input.projectId);
  return { status: "ok" as const, logs };
}

export async function listProjectFiles(input: { userId: string; userRole: string; projectId: string }) {
  const allowed = await userCanAccessProject(input.userId, input.userRole, input.projectId);
  if (!allowed) return { status: "forbidden" as const };

  const files = await findProjectFiles(input.projectId);
  return { status: "ok" as const, files };
}

export async function uploadProjectFile(input: {
  userId: string;
  userRole: string;
  userName: string;
  projectId: string;
  body: any;
}) {
  const allowed = await userCanAccessProject(input.userId, input.userRole, input.projectId);
  if (!allowed) return { status: "forbidden" as const };

  const { fileUrl, fileType } = input.body || {};
  const safeFileUrl = normalizeWebUrl(fileUrl);
  const safeFileType = typeof fileType === "string" ? fileType.trim().slice(0, 120) : "";
  if (!safeFileUrl || !safeFileType) {
    return { status: "missing_file_info" as const };
  }

  const file = await createProjectFile({
    projectId: input.projectId,
    fileUrl: safeFileUrl,
    fileType: safeFileType,
    uploadedBy: input.userName,
  });

  await createProjectLog({
    projectId: input.projectId,
    action: "file_uploaded",
    details: `Uploaded ${safeFileType} document.`,
    userId: input.userId,
  });

  return { status: "ok" as const, file };
}

export async function getProjectDetail(input: { userId: string; userRole: string; projectId: string }) {
  const allowed = await userCanAccessProject(input.userId, input.userRole, input.projectId);
  if (!allowed) return { status: "forbidden" as const };

  const project = await findProjectDetailFull(input.projectId);
  if (!project) return { status: "not_found" as const };

  return { status: "ok" as const, project };
}

/**
 * Allow-listed project detail edit. Only the assigned Account Manager, Head AM
 * or super admin may edit; sensitive fields have dedicated endpoints.
 */
export async function editProjectDetails(input: {
  userId: string;
  userRole: string;
  projectId: string;
  body: any;
}) {
  const allowed = await userCanAccessProject(input.userId, input.userRole, input.projectId);
  if (!allowed) return { status: "forbidden" as const };

  const projectForEdit = await findProjectAccountManagerId(input.projectId);
  if (!projectForEdit) return { status: "not_found" as const };

  const canEditProjectDetails =
    input.userRole === "super_admin" ||
    input.userRole === "head_account_manager" ||
    projectForEdit.accountManagerId === input.userId;

  if (!canEditProjectDetails) {
    return { status: "edit_forbidden" as const };
  }

  // Build a sanitized data object containing only allow-listed fields.
  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input.body as Record<string, unknown>)) {
    if (!ALLOWED_PROJECT_PATCH_FIELDS.has(key)) continue;
    if (PROJECT_DATE_FIELDS.has(key)) {
      data[key] = value ? new Date(value as string) : null;
    } else if (PROJECT_URL_FIELDS.has(key)) {
      if (value === null || value === "") {
        data[key] = null;
      } else {
        const safeUrl = normalizeWebUrl(value as string);
        if (!safeUrl) {
          return { status: "invalid_url" as const, field: key };
        }
        data[key] = safeUrl;
      }
    } else {
      data[key] = value;
    }
  }

  if (Object.keys(data).length === 0) {
    return { status: "no_fields" as const };
  }

  const project = await updateProjectFields(input.projectId, data);
  return { status: "ok" as const, project };
}

/** Super-admin assigns (or clears) the Head Account Manager for a project/client. */
export async function assignHeadAccountManager(input: {
  projectId: string;
  headAccountManagerId: string | null;
}) {
  const { projectId, headAccountManagerId } = input;

  if (headAccountManagerId) {
    const head = await findActiveHeadAccountManagerCandidate(headAccountManagerId);
    if (!head || head.role !== "head_account_manager" || head.status !== "Active") {
      return { status: "invalid_head" as const };
    }
  }

  const project = await updateProjectHeadAccountManager(projectId, headAccountManagerId);

  if (headAccountManagerId) {
    await createProjectAssignmentNotification({
      userId: headAccountManagerId,
      title: "New Client Assigned",
      message: `You have been assigned client "${project.deal?.lead?.name || "a client"}".`,
      type: "project_assigned",
      link: "/dashboard/head-account-manager",
    });
  }

  return { status: "ok" as const, project };
}
