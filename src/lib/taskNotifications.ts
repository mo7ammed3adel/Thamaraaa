/**
 * Shared rules for "you were given a task" notifications.
 *
 * The link must open the dashboard where the recipient's ROLE actually lists
 * the task (each team page queries tasks by leaderId/agentId). The Operations
 * hub is only a fallback for roles without a team page.
 */
const ROLE_TASK_LINKS: Record<string, string> = {
  head_seo: "/dashboard/seo",
  team_leader_seo: "/dashboard/seo",
  agent_seo: "/dashboard/seo",
  agent_content_seo: "/dashboard/seo",
  team_leader_social_media: "/dashboard/social-media",
  agent_social_media: "/dashboard/social-media",
  team_leader_media_buyer: "/dashboard/media-buyer",
  agent_media_buyer: "/dashboard/media-buyer",
  leader_graphic_designer: "/dashboard/design?team=graphic",
  agent_graphic_designer: "/dashboard/design?team=graphic",
  leader_motion_graphic: "/dashboard/design?team=motion",
  agent_motion_graphic: "/dashboard/design?team=motion",
  leader_ui: "/dashboard/design?team=ui",
  agent_ui: "/dashboard/design?team=ui",
  head_technical: "/dashboard/head-technical",
};

const FALLBACK_TASK_LINK = "/dashboard/operations";

export function taskLinkForRole(role?: string | null): string {
  return (role && ROLE_TASK_LINKS[role]) || FALLBACK_TASK_LINK;
}

/** Nobody is notified about their own action (e.g. a leader taking a task themselves). */
export function shouldNotifyAssignee(recipientId: string | null | undefined, actorId: string): recipientId is string {
  return Boolean(recipientId) && recipientId !== actorId;
}

export function formatTaskType(taskType: string): string {
  return taskType.replace(/_/g, " ");
}
