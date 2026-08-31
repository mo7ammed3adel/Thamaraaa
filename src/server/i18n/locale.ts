import { cookies } from "next/headers";
import { LOCALE_COOKIE, normalizeLocale, type Locale } from "@/lib/i18n/config";
import { createTranslator, type Translator } from "@/lib/i18n/translate";

/**
 * The locale for the current request, from the cookie the language switcher
 * sets. Server components call this; there is no request context in client
 * components, which read the same value from LocaleProvider instead.
 */
export function getLocale(): Locale {
  return normalizeLocale(cookies().get(LOCALE_COOKIE)?.value);
}

/** `t` for the current request, for use in server components. */
export function getTranslator(): Translator {
  return createTranslator(getLocale());
}
