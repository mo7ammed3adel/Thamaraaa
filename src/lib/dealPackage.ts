/**
 * Deal package selection helpers.
 *
 * A deal's package can now be composed of one or more services (SEO, Social
 * Media, Media Buying) and may differ month-to-month — e.g. a client who takes
 * the full package in month 1 and SEO only in month 2. The Deal/Project model
 * still stores a single human-readable `package` string, so these helpers turn
 * the structured UI selection into that summary string.
 */

export type PackageMode = "unified" | "monthly";

export type DealPackageInput = {
  packageMode: PackageMode;
  /** Selected services when the package is the same every month. */
  packageServices: string[];
  /** Per-month service selections when the package differs month-to-month. */
  monthlyPackages: { services: string[] }[];
};

const SERVICE_ORDER = ["SEO", "Social", "Media"] as const;

const SERVICE_LABEL: Record<string, string> = {
  SEO: "SEO",
  Social: "Social Media",
  Media: "Media Buying",
};

/** The selectable package services, in display order. */
export const PACKAGE_SERVICES = SERVICE_ORDER.map((value) => ({
  value,
  label: SERVICE_LABEL[value],
}));

/**
 * Human-readable label for one set of selected services. Returns "Full" when
 * every service is chosen, and "" when none are.
 */
export function summarizeServices(services: string[]): string {
  const ordered = SERVICE_ORDER.filter((s) => services.includes(s));
  if (ordered.length === 0) return "";
  if (ordered.length === SERVICE_ORDER.length) return "Full";
  return ordered.map((s) => SERVICE_LABEL[s]).join(" + ");
}

/**
 * Builds the package summary string persisted on the deal/project.
 *   - unified: "SEO + Social Media", "Full", …
 *   - monthly: "M1: Full | M2: SEO", …
 * Returns "" when the selection is incomplete (no services chosen, or any month
 * with no services), so callers can block submission.
 */
export function buildDealPackageLabel(input: DealPackageInput): string {
  if (input.packageMode === "monthly") {
    if (input.monthlyPackages.length === 0) return "";
    const parts: string[] = [];
    for (let i = 0; i < input.monthlyPackages.length; i++) {
      const summary = summarizeServices(input.monthlyPackages[i].services);
      if (!summary) return "";
      parts.push(`M${i + 1}: ${summary}`);
    }
    return parts.join(" | ");
  }
  return summarizeServices(input.packageServices);
}
