import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility to smartly merge Tailwind CSS classes
 * Essential for building generic reusable UI components.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Humanizes a snake_case identifier (role / task type / department) for display,
 * e.g. "team_leader_seo" → "team leader seo". Centralizes the `replace(/_/g, " ")`
 * that was repeated across components and routes.
 */
export function humanize(value: string): string {
  return value.replace(/_/g, " ");
}
