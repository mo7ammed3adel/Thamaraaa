export function canSalesAgentSendMeetingLink(input: {
  senderRole: string;
  senderId: string;
  recipientId: string;
  leadAssignedSalesAgentId?: string | null;
  leadAssignedTeleAgentId?: string | null;
  hasSafeLink: boolean;
}): boolean {
  return (
    input.senderRole === "sales_agent" &&
    input.hasSafeLink &&
    input.leadAssignedSalesAgentId === input.senderId &&
    input.leadAssignedTeleAgentId === input.recipientId
  );
}
