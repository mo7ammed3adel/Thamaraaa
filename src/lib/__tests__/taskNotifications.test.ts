import { describe, expect, it } from "vitest";
import { shouldNotifyAssignee, taskLinkForRole } from "../taskNotifications";

describe("task notification links", () => {
  it("sends each assignee to the team page that lists their tasks", () => {
    expect(taskLinkForRole("agent_seo")).toBe("/dashboard/seo");
    expect(taskLinkForRole("team_leader_social_media")).toBe("/dashboard/social-media");
    expect(taskLinkForRole("agent_media_buyer")).toBe("/dashboard/media-buyer");
    expect(taskLinkForRole("head_technical")).toBe("/dashboard/head-technical");
  });

  it("opens the right design team tab instead of always defaulting to graphic", () => {
    expect(taskLinkForRole("leader_motion_graphic")).toBe("/dashboard/design?team=motion");
    expect(taskLinkForRole("agent_ui")).toBe("/dashboard/design?team=ui");
  });

  it("falls back to the operations hub for roles without a team page", () => {
    expect(taskLinkForRole("account_manager")).toBe("/dashboard/operations");
    expect(taskLinkForRole(undefined)).toBe("/dashboard/operations");
  });
});

describe("shouldNotifyAssignee", () => {
  it("skips the actor's own action and empty recipients", () => {
    expect(shouldNotifyAssignee("u1", "u1")).toBe(false);
    expect(shouldNotifyAssignee(null, "u1")).toBe(false);
    expect(shouldNotifyAssignee("u2", "u1")).toBe(true);
  });
});
