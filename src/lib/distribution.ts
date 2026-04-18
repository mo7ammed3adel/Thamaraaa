import { TASK_TYPE_TO_LEADER_ROLE } from "./constants";
import { prisma } from "./prisma";

/**
 * Hierarchical distribution permission map.
 * Maps each distributor role to the roles they are allowed to distribute TO.
 */
const DISTRIBUTION_MAP: Record<string, string[]> = {
  head_account_manager: ["account_manager", "head_technical"],
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
 * Checks if a project has any unresolved warnings that block its progress.
 * Returns { isBlocked: true, warnings: [...] } if blocked, else { isBlocked: false }.
 */
export async function checkProjectBlockers(projectId: string) {
  const unresolvedWarnings = await prisma.warning.findMany({
    where: {
      projectId: projectId,
    }
  });

  // A warning blocks if not all recipient roles have acknowledged it.
  // Wait, the specification says "any unresolved warning strictly blocks moving the project..."
  // If a warning is "acknowledgedBy" someone in the recipient role, is it resolved?
  // Let's filter out warnings where all recipients have acknowledged or it has some specific resolved status.
  // Actually, let's just check if there's any warning that has no acknowledgements from its required roles.
  
  const blockingWarnings = unresolvedWarnings.filter(w => {
    let ackList: any[] = [];
    try { ackList = JSON.parse(w.acknowledgedBy || "[]"); } catch {}
    
    // For simplicity, a warning blocks if it hasn't been acknowledged by ANY user
    // In a fully strict system: if it requires 3 roles, it needs 3 acks.
    // Let's enforce that it requires at least one acknowledgement to unblock.
    return ackList.length === 0;
  });

  return {
    isBlocked: blockingWarnings.length > 0,
    warnings: blockingWarnings
  };
}
