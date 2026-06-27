import { describe, expect, it } from "vitest";
import { canDistributeTo, getDistributionTargets } from "../distribution";

describe("distribution permissions", () => {
  it("allows account managers to assign head technical and head SEO on their projects", () => {
    expect(canDistributeTo("account_manager", "head_technical")).toBe(true);
    expect(canDistributeTo("account_manager", "head_seo")).toBe(true);
  });

  it("includes head technical in account manager distribution targets", () => {
    expect(getDistributionTargets("account_manager")).toEqual(
      expect.arrayContaining(["head_technical", "head_seo"]),
    );
  });

  it("does not allow account managers to assign unrelated execution roles directly", () => {
    expect(canDistributeTo("account_manager", "agent_social_media")).toBe(false);
  });
});
