/**
 * Meeting-date guards shared by the UI (date-picker `min`) and the API
 * (server-side validation). A meeting may be booked for today or any future
 * day, but never for a date in the past.
 */

/** Local calendar today as a YYYY-MM-DD string — use as the `min` of a date input. */
export function todayInputValue(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Whether a picked YYYY-MM-DD meeting date falls before today. Compared at UTC
 * midnight — the same convention meetings are stored with
 * (`new Date(date + "T00:00:00Z")`) — so the current day is always allowed and
 * only genuinely past days are rejected. Empty/invalid input is treated as
 * "not past" so callers keep their existing required-field handling.
 */
export function isPastMeetingDate(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  const picked = new Date(`${dateStr}T00:00:00Z`).getTime();
  if (Number.isNaN(picked)) return false;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return picked < today.getTime();
}
