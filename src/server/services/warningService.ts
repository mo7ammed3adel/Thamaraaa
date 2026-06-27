import {
  acknowledgeWarningReceipt,
  findWarningById,
  findUnreadWarningReceiptsForUser,
  findWarningReceiptForUser,
  resolveWarningWithLog,
} from "@/server/repositories/warningRepository";
import { canResolveWarning } from "@/lib/distribution";

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
