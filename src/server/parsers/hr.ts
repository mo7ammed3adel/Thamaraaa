import { parseJsonArray } from "./json";

export type PerformanceHistoryEntry = {
  month: string;
  hitTarget: boolean;
};

export function parsePerformanceHistory(raw: string | null | undefined): PerformanceHistoryEntry[] {
  return parseJsonArray<PerformanceHistoryEntry>(raw);
}
