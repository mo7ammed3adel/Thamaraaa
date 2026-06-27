export type WarningSeverity = "Low" | "Medium" | "High" | "Critical";

export type WarningStatus = "Active" | "Resolved" | "Archived";

export type WarningReceiptDto = {
  id: string;
  warningId: string;
  userId: string;
  isRead: boolean;
  readAt?: string | null;
  deliveredViaEmail: boolean;
  emailSentAt?: string | null;
  createdAt: string;
};

export type WarningDto = {
  id: string;
  clientId?: string | null;
  projectId?: string | null;
  subject: string;
  message: string;
  severity: WarningSeverity | string;
  status: WarningStatus | string;
  senderUserId: string;
  senderRole: string;
  recipientRoles: string[];
  resolvedAt?: string | null;
  resolvedByUserId?: string | null;
  createdAt: string;
  receipts?: WarningReceiptDto[];
};
