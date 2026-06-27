const MANUAL_DISTRIBUTION_STATUSES = new Set(["Transferred", "Waiting"]);

export function canManuallyDistributeMeeting(lead: {
  status?: string | null;
  meetingDate?: unknown;
  assignedSalesAgentId?: string | null;
}): boolean {
  return Boolean(
    lead.meetingDate &&
      !lead.assignedSalesAgentId &&
      lead.status &&
      MANUAL_DISTRIBUTION_STATUSES.has(lead.status),
  );
}
