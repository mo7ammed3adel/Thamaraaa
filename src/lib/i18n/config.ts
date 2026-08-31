/**
 * Locale configuration.
 *
 * The locale lives in a cookie rather than in the URL. A `/[locale]/…` segment
 * would mean rewriting every route, redirect and Link in the app for no user
 * benefit — the audience is one company, and people switch language once.
 */

export const LOCALES = ["ar", "en"] as const;

export type Locale = (typeof LOCALES)[number];

/** Arabic is the team's working language, so it is what a new visitor gets. */
export const DEFAULT_LOCALE: Locale = "ar";

export const LOCALE_COOKIE = "NEXT_LOCALE";

/** How long a chosen language is remembered, in seconds (one year). */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const LOCALE_LABELS: Record<Locale, string> = {
  ar: "العربية",
  en: "English",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Falls back to the default rather than throwing, so a stale cookie is harmless. */
export function normalizeLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export function getDirection(locale: Locale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}
