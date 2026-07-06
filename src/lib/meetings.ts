/**
 * Meeting statuses that mean the client actually showed up. "Scheduled" is a
 * booking that hasn't happened yet and "No_Show" means the client never came,
 * so neither counts toward tele-sales targets, bonuses, or commissions.
 */
export const ACTUAL_MEETING_STATUSES = ["Attended", "Won", "Lost"];
