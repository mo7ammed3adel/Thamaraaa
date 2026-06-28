export type DateRangePreset =
  | "today"
  | "yesterday"
  | "this_week"
  | "this_month"
  | "last_7_days"
  | "last_30_days"
  | "last_month"
  | "all";

export type DateRangeValue = {
  from: string;
  to: string;
};

export function toDateInputValue(date: Date): string {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().split("T")[0];
}

export function getDateRangePreset(preset: DateRangePreset, now = new Date()): DateRangeValue {
  if (preset === "all") return { from: "", to: "" };

  if (preset === "today") {
    return { from: toDateInputValue(now), to: toDateInputValue(now) };
  }

  if (preset === "yesterday") {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return { from: toDateInputValue(yesterday), to: toDateInputValue(yesterday) };
  }

  if (preset === "this_week") {
    const start = new Date(now);
    start.setDate(start.getDate() - start.getDay());
    return { from: toDateInputValue(start), to: toDateInputValue(now) };
  }

  if (preset === "this_month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: toDateInputValue(start), to: toDateInputValue(now) };
  }

  if (preset === "last_7_days") {
    const start = new Date(now);
    start.setDate(start.getDate() - 7);
    return { from: toDateInputValue(start), to: toDateInputValue(now) };
  }

  if (preset === "last_30_days") {
    const start = new Date(now);
    start.setDate(start.getDate() - 30);
    return { from: toDateInputValue(start), to: toDateInputValue(now) };
  }

  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 0);
  return { from: toDateInputValue(start), to: toDateInputValue(end) };
}

export function parseDateRangeStart(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1, 0, 0, 0, 0);
}

export function parseDateRangeEnd(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1, 23, 59, 59, 999);
}

export function isDateInRange(value: string | Date | null | undefined, range: DateRangeValue): boolean {
  if (!range.from && !range.to) return true;
  if (!value) return false;

  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return false;

  if (range.from && target < parseDateRangeStart(range.from)) return false;
  if (range.to && target > parseDateRangeEnd(range.to)) return false;
  return true;
}
