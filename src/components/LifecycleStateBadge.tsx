"use client";

import { LIFECYCLE_STATE } from "@/lib/constants";

/** Color/style map for each lifecycle state */
const STATE_STYLES: Record<string, { bg: string; text: string; ring: string }> = {
  [LIFECYCLE_STATE.ACTIVE]: { bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-200" },
  [LIFECYCLE_STATE.HOLD]: { bg: "bg-amber-50", text: "text-amber-700", ring: "ring-amber-200" },
  [LIFECYCLE_STATE.RENEWER]: { bg: "bg-blue-50", text: "text-blue-700", ring: "ring-blue-200" },
  [LIFECYCLE_STATE.LOST]: { bg: "bg-red-50", text: "text-red-700", ring: "ring-red-200" },
};

const STATE_LABELS: Record<string, string> = {
  [LIFECYCLE_STATE.ACTIVE]: "Active",
  [LIFECYCLE_STATE.HOLD]: "Hold",
  [LIFECYCLE_STATE.RENEWER]: "Renewer",
  [LIFECYCLE_STATE.LOST]: "Lost",
};

interface LifecycleStateBadgeProps {
  /** Current lifecycle state of the project */
  state: string;
  /** Optional: use compact size */
  compact?: boolean;
}

/**
 * Renders a color-coded badge for a project's lifecycle state.
 * @param state Lifecycle state string
 * @param compact Optional: use smaller badge size
 */
export default function LifecycleStateBadge({ state, compact = false }: LifecycleStateBadgeProps) {
  const style = STATE_STYLES[state] || { bg: "bg-gray-50", text: "text-gray-600", ring: "ring-gray-200" };
  const label = STATE_LABELS[state] || state;

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ring-1 ring-inset ${style.bg} ${style.text} ${style.ring} ${
        compact ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs"
      }`}
    >
      <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${style.text.replace("text-", "bg-")}`} />
      {label}
    </span>
  );
}
