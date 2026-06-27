type DateFormatOptions = Intl.DateTimeFormatOptions & {
  locale?: string | string[];
  fallback?: string;
};

function toDate(value: string | number | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value: string | number | Date | null | undefined, options: DateFormatOptions = {}): string {
  const { locale, fallback = "", ...dateOptions } = options;
  const date = toDate(value);
  return date ? date.toLocaleDateString(locale, dateOptions) : fallback;
}

export function formatDateTime(value: string | number | Date | null | undefined, options: DateFormatOptions = {}): string {
  const { locale, fallback = "", ...dateOptions } = options;
  const date = toDate(value);
  return date ? date.toLocaleString(locale, dateOptions) : fallback;
}

export function formatTime(value: string | number | Date | null | undefined, options: DateFormatOptions = {}): string {
  const { locale, fallback = "", ...dateOptions } = options;
  const date = toDate(value);
  return date ? date.toLocaleTimeString(locale, dateOptions) : fallback;
}
