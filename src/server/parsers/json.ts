export function parseJsonOr<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function parseJsonArray<T>(raw: string | null | undefined): T[] {
  const parsed = parseJsonOr<unknown>(raw, []);
  return Array.isArray(parsed) ? (parsed as T[]) : [];
}

export function stringifyJson(value: unknown): string {
  return JSON.stringify(value);
}
