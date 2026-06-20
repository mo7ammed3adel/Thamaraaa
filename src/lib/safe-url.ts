const WEB_PROTOCOLS = new Set(["http:", "https:"]);

export function normalizeWebUrl(value: unknown, maxLength = 2048): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) return null;

  try {
    const parsed = new URL(trimmed);
    if (!WEB_PROTOCOLS.has(parsed.protocol)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function normalizeNotificationLink(value: unknown, maxLength = 2048): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) return null;
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed;

  return normalizeWebUrl(trimmed, maxLength);
}
