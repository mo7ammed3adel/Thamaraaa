import { describe, expect, it } from "vitest";
import { DIRECT_MANAGER_ROLES } from "../constants";

describe("DIRECT_MANAGER_ROLES", () => {
  it("includes leadership roles that can manage agents", () => {
    expect(DIRECT_MANAGER_ROLES).toEqual(
      expect.arrayContaining([
        "chief_sales",
        "team_leader_seo",
        "leader_graphic_designer",
        "leader_motion_graphic",
      ]),
    );
  });

  it("does not include agent roles in direct manager choices", () => {
    expect(DIRECT_MANAGER_ROLES).not.toEqual(
      expect.arrayContaining([
        "sales_agent",
        "agent_seo",
        "agent_graphic_designer",
        "agent_motion_graphic",
      ]),
    );
  });
});
