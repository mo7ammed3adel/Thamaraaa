import {
  acknowledgeWarningReceipt,
  findWarningById,
  findUnreadWarningReceiptsForUser,
  findWarningReceiptForUser,
  resolveWarningWithLog,
} from "@/server/repositories/warningRepository";
import { canResolveWarning } from "@/lib/distribution";
import { prisma } from "@/lib/prisma";
import { sendWarningEmail } from "@/lib/email";
import { safeTrigger } from "@/lib/pusher";
import { SEVERITY, WARNING_ISSUER_ROLES } from "@/lib/constants";

const VALID_SEVERITIES = new Set(Object.values(SEVERITY));

function normalizeSeverity(severity: unknown) {
  return typeof severity === "string" && VALID_SEVERITIES.has(severity as any)
    ? severity
    : SEVERITY.MEDIUM;
}

function normalizeRecipientRoles(recipientRoles: unknown) {
  if (!Array.isArray(recipientRoles)) return [];
  return recipientRoles.filter((role): role is string => typeof role === "string");
}

function canIssueWarningForProject(user: { id: string; role?: string | null }, project: any) {
  if (!user.role || !(WARNING_ISSUER_ROLES as readonly string[]).includes(user.role)) return false;
  if (user.role === "super_admin" || user.role === "head_account_manager") return true;
  if (user.role === "account_manager") return project.accountManagerId === user.id;
  if (user.role === "sales_agent") return project.deal?.salesAgentId === user.id;
  if (user.role === "sales_manager") {
    return project.deal?.salesAgent?.directManagerId === user.id;
  }
  return false;
}

export async function listUnreadWarnings(userId: string) {
  const receipts = await findUnreadWarningReceiptsForUser(userId);

  return receipts.map((r) => ({
    id: r.warning.id,
    subject: r.warning.subject,
    message: r.warning.message,
    severity: r.warning.severity,
    senderRole: r.warning.senderRole,
    senderUserId: r.warning.senderUserId,
    senderName: r.warning.sender?.name ?? "System",
    createdAt: r.warning.createdAt,
    userAcknowledged: false,
    receiptId: r.id,
  }));
}

export async function listUnreadWarningsWithSenderRole(userId: string) {
  const receipts = await findUnreadWarningReceiptsForUser(userId);

  return receipts.map((r: any) => ({
    id: r.warning.id,
    subject: r.warning.subject,
    message: r.warning.message,
    severity: r.warning.severity,
    senderName: r.warning.sender.name,
    senderRole: r.warning.sender.role,
    createdAt: r.warning.createdAt,
    receiptId: r.id,
  }));
}

export async function acknowledgeWarningForUser(input: {
  warningId: string;
  userId: string;
  userName?: string | null;
}) {
  const receipt = await findWarningReceiptForUser(input.warningId, input.userId);
  if (!receipt) return { status: "not_found" as const };
  if (receipt.isRead) return { status: "already_read" as const };

  const updated = await acknowledgeWarningReceipt({
    receiptId: receipt.id,
    warningId: input.warningId,
    userId: input.userId,
    userName: input.userName,
  });

  return { status: "ok" as const, receipt: updated };
}

export async function resolveWarningForUser(input: {
  warningId: string;
  userId: string;
  userName: string;
}) {
  const warning = await findWarningById(input.warningId);
  if (!warning) return { status: "not_found" as const };
  if (warning.status === "Resolved") return { status: "already_resolved" as const };
  if (!canResolveWarning(input.userId, warning.senderUserId)) {
    return { status: "forbidden" as const };
  }

  const resolvedAt = new Date();
  const updatedWarning = await resolveWarningWithLog({
    warningId: input.warningId,
    projectId: warning.projectId,
    subject: warning.subject,
    userId: input.userId,
    userName: input.userName,
    resolvedAt,
  });

  return { status: "ok" as const, warning: updatedWarning };
}

export async function createProjectWarning(input: {
  actor: { id: string; name?: string | null; role?: string | null };
  body: any;
}) {
  const { subject, message, severity, projectId, clientId } = input.body;
  const recipientRoles = normalizeRecipientRoles(input.body.recipientRoles);

  if (!message || !projectId) {
    return { status: "invalid" as const };
  }

  const projectForAuth = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      accountManagerId: true,
      headTechnicalId: true,
      headSeoId: true,
      deal: {
        select: {
          salesAgentId: true,
          salesAgent: { select: { directManagerId: true } },
        },
      },
    },
  });

  if (!projectForAuth) {
    return { status: "project_not_found" as const };
  }

  if (!canIssueWarningForProject(input.actor, projectForAuth)) {
    return { status: "forbidden" as const };
  }

  const warning = await prisma.$transaction(async (tx) => {
    const w = await tx.warning.create({
      data: {
        subject: subject || "Warning",
        message,
        severity: normalizeSeverity(severity),
        projectId,
        clientId: typeof clientId === "string" ? clientId : null,
        senderUserId: input.actor.id,
        senderRole: input.actor.role || "",
        recipientRoles: JSON.stringify(recipientRoles),
      },
    });

    const project = await tx.project.findUnique({
      where: { id: projectId },
      include: {
        teamAssignments: { where: { status: "active" } },
        deal: { select: { salesAgentId: true } },
      },
    });

    if (!project) throw new Error("Project not found");

    const hdAMs = await tx.user.findMany({ where: { role: "head_account_manager" } });

    const affectedUserIds = new Set<string>();
    if (project.accountManagerId) affectedUserIds.add(project.accountManagerId);
    if (project.headTechnicalId) affectedUserIds.add(project.headTechnicalId);
    if (project.headSeoId) affectedUserIds.add(project.headSeoId);
    if (project.deal?.salesAgentId) affectedUserIds.add(project.deal.salesAgentId);
    hdAMs.forEach((h) => affectedUserIds.add(h.id));
    project.teamAssignments.forEach((t) => affectedUserIds.add(t.userId));

    affectedUserIds.delete(input.actor.id);

    const affectedUserIdsArray = Array.from(affectedUserIds);

    if (affectedUserIdsArray.length > 0) {
      await tx.warningReceipt.createMany({
        data: affectedUserIdsArray.map((userId) => ({
          warningId: w.id,
          userId,
          isRead: false,
        })),
      });
    }

    await tx.projectLog.create({
      data: {
        projectId,
        userId: input.actor.id,
        action: "warning_issued",
        details: `Warning issued: ${w.subject} (${w.severity})`,
      },
    });

    return { warning: w, affectedUserIdsArray };
  });

  const { warning: w, affectedUserIdsArray } = warning;

  if (affectedUserIdsArray.length > 0) {
    const usersToNotify = await prisma.user.findMany({
      where: { id: { in: affectedUserIdsArray } },
    });

    const deliveryPromises = usersToNotify.map(async (user) => {
      await safeTrigger(`user-${user.id}`, "new-warning", {
        id: w.id,
        warningId: w.id,
        subject: w.subject,
        message: w.message,
        severity: w.severity,
        senderRole: w.senderRole,
        senderUserId: w.senderUserId,
        createdAt: w.createdAt,
      });

      if (user.email) {
        const result = await sendWarningEmail(
          user.email,
          `Warning: ${w.subject}`,
          w.message,
          input.actor.name as string
        );
        if (result.success) {
          await prisma.warningReceipt.update({
            where: { warningId_userId: { warningId: w.id, userId: user.id } },
            data: { deliveredViaEmail: true, emailSentAt: new Date() },
          });
        }
      }
    });

    await Promise.allSettled(deliveryPromises);
  }

  return {
    status: "ok" as const,
    warning: { id: w.id, receiptsCreated: affectedUserIdsArray.length },
  };
}
