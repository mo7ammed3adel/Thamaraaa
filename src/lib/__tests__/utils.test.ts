import { describe, it, expect } from "vitest";
import { humanize } from "../utils";

describe("humanize", () => {
  it("replaces underscores with spaces", () => {
    expect(humanize("team_leader_seo")).toBe("team leader seo");
    expect(humanize("agent_content_seo")).toBe("agent content seo");
  });

  it("leaves single words unchanged", () => {
    expect(humanize("accountant")).toBe("accountant");
  });

  it("handles empty strings", () => {
    expect(humanize("")).toBe("");
  });
});
