import {
  acknowledgeWarningReceipt,
  findUnreadWarningReceiptsForUser,
  findWarningReceiptForUser,
} from "@/server/repositories/warningRepository";

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
