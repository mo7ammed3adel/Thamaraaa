"use client";

import { createContext, useContext, useMemo } from "react";
import { DEFAULT_LOCALE, getDirection, type Locale } from "@/lib/i18n/config";
import { createTranslator, type Translator } from "@/lib/i18n/translate";

type LocaleContextValue = {
  locale: Locale;
  dir: "rtl" | "ltr";
  t: Translator;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

/**
 * Carries the request's locale into client components. The value is decided on
 * the server and passed down, so the first paint is already in the right
 * language — no flash of the wrong one.
 */
export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const value = useMemo(
    () => ({ locale, dir: getDirection(locale), t: createTranslator(locale) }),
    [locale]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

/**
 * Reads the current locale, direction and translator.
 * Falls back to the default outside a provider so a stray component still renders.
 */
export function useLocale(): LocaleContextValue {
  const value = useContext(LocaleContext);
  if (value) return value;

  return {
    locale: DEFAULT_LOCALE,
    dir: getDirection(DEFAULT_LOCALE),
    t: createTranslator(DEFAULT_LOCALE),
  };
}

/** Shorthand for the common case of only needing `t`. */
export function useTranslator(): Translator {
  return useLocale().t;
}
