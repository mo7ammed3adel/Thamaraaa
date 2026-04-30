import { TASK_TYPE_TO_LEADER_ROLE, TEAM_LEADER_ROLES } from "./constants";
import { prisma } from "./prisma";

/**
 * Hierarchical distribution permission map.
 * Maps each distributor role to the roles they are allowed to distribute TO.
 */
const DISTRIBUTION_MAP: Record<string, string[]> = {
  head_account_manager: ["account_manager", "head_technical", "head_seo"],
  head_technical: ["team_leader_social_media", "team_leader_media_buyer"],
  account_manager: ["head_seo"],
  head_seo: ["team_leader_seo"],
  team_leader_social_media: ["agent_social_media"],
  team_leader_media_buyer: ["agent_media_buyer"],
  team_leader_seo: ["agent_seo", "agent_content_seo"],
  leader_graphic_designer: ["agent_graphic_designer"],
  leader_motion_graphic: ["agent_motion_graphic"],
  leader_ui: ["agent_ui"],
  super_admin: [
    "account_manager", "head_technical", "head_seo",
    "team_leader_social_media", "team_leader_media_buyer", "team_leader_seo",
    "agent_social_media", "agent_media_buyer", "agent_seo", "agent_content_seo",
    "agent_graphic_designer", "agent_motion_graphic", "agent_ui",
    "leader_graphic_designer", "leader_motion_graphic", "leader_ui",
  ],
};

/**
 * Checks whether a distributor role is allowed to distribute to a target role.
 * @param distributorRole The role of the user doing the distribution
 * @param targetRole The role of the user being distributed to
 * @returns true if the distribution is allowed
 */
export function canDistributeTo(distributorRole: string, targetRole: string): boolean {
  const allowedTargets = DISTRIBUTION_MAP[distributorRole];
  if (!allowedTargets) return false;
  return allowedTargets.includes(targetRole);
}

/**
 * Returns the list of roles a given distributor can distribute to.
 * @param distributorRole The role of the user doing the distribution
 * @returns Array of allowed target role strings, or empty if none
 */
export function getDistributionTargets(distributorRole: string): string[] {
  return DISTRIBUTION_MAP[distributorRole] || [];
}

/**
 * Finds the Team Leader role responsible for a given cross-team task type.
 * @param taskType The type of cross-team task (e.g., "graphic_design", "motion_graphic")
 * @returns The leader role string, or null if not a valid cross-team task type
 */
export function findTeamLeaderRoleForTaskType(taskType: string): string | null {
  return TASK_TYPE_TO_LEADER_ROLE[taskType as keyof typeof TASK_TYPE_TO_LEADER_ROLE] || null;
}

/**
 * Checks if a project has any unresolved, unacknowledged warnings that block its progress.
 * Uses the WarningReceipt table for acknowledgment tracking (not deprecated acknowledgedBy JSON).
 * Returns { isBlocked: true, warnings: [...] } if blocked, else { isBlocked: false }.
 */
export async function checkProjectBlockers(projectId: string) {
  const unresolvedWarnings = await prisma.warning.findMany({
    where: {
      projectId: projectId,
      status: { not: "Resolved" },
    },
    include: {
      receipts: true,
    },
  });

  // A warning blocks if it has no acknowledgment receipts from any user.
  // Resolved warnings are excluded from the query above.
  const blockingWarnings = unresolvedWarnings.filter((w: any) => {
    const receiptCount = w.receipts?.length ?? 0;
    return receiptCount === 0;
  });

  return {
    isBlocked: blockingWarnings.length > 0,
    warnings: blockingWarnings,
  };
}


/**
 * Checks whether a user can flag/return a task.
 * Only the currently assigned agent can flag their own task.
 * @param userRole - Role of the user attempting to flag
 * @param taskAgentId - The user ID currently assigned as the task agent
 * @param currentUserId - The user ID of the person attempting the flag
 * @returns true if the user is the assigned agent for this task
 */
export function canFlagTask(
  userRole: string,
  taskAgentId: string | null,
  currentUserId: string
): boolean {
  if (!taskAgentId) return false;
  return taskAgentId === currentUserId;
}

/**
 * Checks whether a user can reassign a task within their team.
 * Only Team Leader roles are allowed to reassign tasks.
 * @param userRole - Role of the user attempting the reassignment
 * @returns true if the user has a Team Leader role
 */
export function canReassignTask(userRole: string): boolean {
  if (userRole === "super_admin") return true;
  return TEAM_LEADER_ROLES.includes(userRole as typeof TEAM_LEADER_ROLES[number]);
}

/**
 * Checks whether a user can resolve a warning.
 * Only the original sender of a warning can mark it as resolved.
 * @param userId - The user ID of the person attempting to resolve
 * @param warningSenderUserId - The user ID of the warning creator
 * @returns true if the user is the warning creator
 */
export function canResolveWarning(
  userId: string,
  warningSenderUserId: string
): boolean {
  return userId === warningSenderUserId;
}
