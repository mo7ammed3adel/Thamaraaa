import { canChangeLifecycle, validateLifecycleTransition } from "@/lib/lifecycle";
import { safeTrigger } from "@/lib/pusher";
import { backfillReceiptsForNewMember, checkProjectBlockers } from "@/lib/distribution";
import { normalizeWebUrl } from "@/lib/safe-url";
import { notifyHeadAccountManagersOfNewProject } from "@/lib/projectSetup";
import {
  createProjectLog,
  createProjectFromDealWithLog,
  findActiveAccountManager,
  findDealForProjectSetup,
  findProjectByDealId,
  findProjectLifecycleAuth,
  findProjectSetupAuth,
  findProjectStatusAuth,
  updateProjectFields,
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
