import { backfillReceiptsForNewMember, canDistributeTo } from "@/lib/distribution";
import {
  createProjectLog,
  findActiveUserForAssignment,
  findProjectStatusAuth,
  updateProjectFields,
} from "@/server/repositories/projectRepository";

export async function assignProjectRole(input: {
  projectId: string;
  userId: string;
  userRole: string;
  body: any;
}) {
  const { targetRole, assigneeId } = input.body;

  if (!targetRole || !assigneeId) {
    return { status: "missing_fields" as const };
  }

  if (!canDistributeTo(input.userRole, targetRole)) {
    return { status: "cannot_assign" as const, targetRole };
  }

  const assignee = await findActiveUserForAssignment(assigneeId);
  if (!assignee || assignee.status !== "Active" || assignee.role !== targetRole) {
    return { status: "invalid_assignee" as const };
  }

  const project = await findProjectStatusAuth(input.projectId);
  if (!project) return { status: "project_not_found" as const };

  if (input.userRole === "account_manager" && project.accountManagerId !== input.userId) {
    return { status: "own_account_manager_forbidden" as const };
  }
  if (input.userRole === "head_technical" && project.headTechnicalId !== input.userId) {
    return { status: "own_head_technical_forbidden" as const };
  }
  if (input.userRole === "head_seo" && project.headSeoId !== input.userId) {
    return { status: "own_head_seo_forbidden" as const };
  }

  const updateData: {
    accountManagerId?: string;
    headTechnicalId?: string;
    headSeoId?: string;
    projectStatus?: string;
    assignedAt?: Date;
  } = {};

  if (targetRole === "account_manager") {
    updateData.accountManagerId = assigneeId;
    updateData.projectStatus = "assigned";
    updateData.assignedAt = new Date();
  } else if (targetRole === "head_technical") {
    updateData.headTechnicalId = assigneeId;
  } else if (targetRole === "head_seo") {
    updateData.headSeoId = assigneeId;
  } else {
    return { status: "unsupported_role" as const };
  }

  const updatedProject = await updateProjectFields(input.projectId, updateData);

  await backfillReceiptsForNewMember(input.projectId, assigneeId);

  await createProjectLog({
    projectId: updatedProject.id,
    action: "assigned",
    details: `${targetRole.replace(/_/g, " ").toUpperCase()} assigned to ${assigneeId}`,
    userId: input.userId,
  });

  return { status: "ok" as const, project: updatedProject };
}
