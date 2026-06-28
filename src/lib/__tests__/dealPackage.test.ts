import { describe, expect, it } from "vitest";
import { buildDealPackageLabel, summarizeServices } from "../dealPackage";

describe("deal package label", () => {
  it("summarizes a single service", () => {
    expect(summarizeServices(["SEO"])).toBe("SEO");
  });

  it("joins multiple services in canonical order", () => {
    expect(summarizeServices(["Media", "SEO"])).toBe("SEO + Media Buying");
  });

  it("collapses all services to 'Full'", () => {
    expect(summarizeServices(["SEO", "Social", "Media"])).toBe("Full");
  });

  it("returns empty for no services", () => {
    expect(summarizeServices([])).toBe("");
  });

  it("builds a unified package label", () => {
    expect(
      buildDealPackageLabel({
        packageMode: "unified",
        packageServices: ["SEO", "Social"],
        monthlyPackages: [],
      })
    ).toBe("SEO + Social Media");
  });

  it("builds a per-month package breakdown", () => {
    expect(
      buildDealPackageLabel({
        packageMode: "monthly",
        packageServices: [],
        monthlyPackages: [
          { services: ["SEO", "Social", "Media"] },
          { services: ["SEO"] },
        ],
      })
    ).toBe("M1: Full | M2: SEO");
  });

  it("returns empty when a month has no services selected", () => {
    expect(
      buildDealPackageLabel({
        packageMode: "monthly",
        packageServices: [],
        monthlyPackages: [{ services: ["SEO"] }, { services: [] }],
      })
    ).toBe("");
  });
});
