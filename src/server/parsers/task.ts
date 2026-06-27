import type { TaskChecklistItem, TaskFileEntry } from "@/contracts/task";
import { normalizeWebUrl } from "@/lib/safe-url";
import { parseJsonArray, stringifyJson } from "./json";

type NormalizedFilesResult = { value: string | null } | { error: string };

export function parseTaskChecklistItems(raw: string | null | undefined): TaskChecklistItem[] {
  return parseJsonArray<TaskChecklistItem>(raw);
}

export function stringifyTaskChecklistItems(items: TaskChecklistItem[]): string {
  return stringifyJson(items);
}

export function parseTaskFiles(raw: string | null | undefined): TaskFileEntry[] {
  return parseJsonArray<TaskFileEntry>(raw);
}

export function normalizeDeliverableFiles(value: unknown): NormalizedFilesResult {
  if (value === null || value === "") return { value: null };

  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return { error: "files must be valid JSON" };
    }
  }

  if (!Array.isArray(parsed)) return { error: "files must be an array" };
  if (parsed.length > 50) return { error: "files cannot contain more than 50 links" };

  const normalized = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") return { error: "Invalid file entry" };
    const entry = item as { label?: unknown; url?: unknown };
    const safeUrl = normalizeWebUrl(entry.url);
    if (!safeUrl) return { error: "Each deliverable URL must be a valid http(s) URL" };
    const label =
      typeof entry.label === "string" && entry.label.trim()
        ? entry.label.trim().slice(0, 120)
        : "Deliverable";
    normalized.push({ label, url: safeUrl });
  }

  return { value: stringifyJson(normalized) };
}
