export const USER_ROLES = [
  "super_admin",
  "tele_sales_agent",
  "tele_sales_manager",
  "sales_agent",
  "sales_manager",
  "chief_sales",
  "head_account_manager",
  "account_manager",
  "head_technical",
  "head_seo",
  "team_leader_seo",
  "agent_seo",
  "agent_content_seo",
  "team_leader_media_buyer",
  "agent_media_buyer",
  "team_leader_social_media",
  "agent_social_media",
  "leader_graphic_designer",
  "agent_graphic_designer",
  "leader_motion_graphic",
  "agent_motion_graphic",
  "leader_ui",
  "agent_ui",
  "hr_manager",
  "accountant",
  "team_leader",
  "operations_agent",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

const USER_ROLE_SET = new Set<string>(USER_ROLES);

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && USER_ROLE_SET.has(value);
}

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: "Super Admin",
  tele_sales_agent: "Tele Sales Agent",
  tele_sales_manager: "Tele Sales Manager",
  sales_agent: "Sales Agent",
  sales_manager: "Sales Manager",
  chief_sales: "Chief Sales",
  head_account_manager: "Head Account Manager",
  account_manager: "Account Manager",
  head_technical: "Head Technical",
  head_seo: "Head SEO",
  team_leader_seo: "Team Leader SEO",
  agent_seo: "SEO Agent",
  agent_content_seo: "Content SEO Agent",
  team_leader_media_buyer: "Team Leader Media Buyer",
  agent_media_buyer: "Media Buyer Agent",
  team_leader_social_media: "Team Leader Social Media",
  agent_social_media: "Social Media Agent",
  leader_graphic_designer: "Graphic Design Leader",
  agent_graphic_designer: "Graphic Designer",
  leader_motion_graphic: "Motion Graphic Leader",
  agent_motion_graphic: "Motion Graphic Agent",
  leader_ui: "UI Leader",
  agent_ui: "UI Agent",
  hr_manager: "HR Manager",
  accountant: "Accountant",
  team_leader: "Team Leader",
  operations_agent: "Operations Agent",
};

export function getRoleLabel(role: string | null | undefined): string {
  if (!role) return "";
  return isUserRole(role) ? ROLE_LABELS[role] : role.replace(/_/g, " ");
}
