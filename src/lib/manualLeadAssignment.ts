export function resolveManualLeadAssigneeId({
  creatorId,
  creatorRole,
  requestedTeleAgentId,
}: {
  creatorId: string;
  creatorRole: string;
  requestedTeleAgentId?: string | null;
}): string | null {
  if (creatorRole === "tele_sales_agent") {
    return creatorId;
  }

  if (!requestedTeleAgentId || requestedTeleAgentId === creatorId) {
    return null;
  }

  return requestedTeleAgentId;
}
