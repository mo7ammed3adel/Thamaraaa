"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import {
  LOCALES,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  LOCALE_LABELS,
  type Locale,
} from "@/lib/i18n/config";
import { useLocale } from "./LocaleProvider";

/**
 * Per-employee language toggle.
 *
 * The choice is stored in a cookie on that person's own browser, so each
 * employee reads the system in the language they prefer without affecting
 * anyone else. Writing the cookie here rather than through an endpoint keeps
 * the switch instant; router.refresh() then re-renders the server components
 * with the new locale.
 */
export default function LanguageSwitcher({ variant = "header" }: { variant?: "header" | "sidebar" }) {
  const { locale, t } = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function selectLocale(next: Locale) {
    if (next === locale) return;
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
    startTransition(() => router.refresh());
  }

  if (variant === "sidebar") {
    return (
      <div className="flex items-center gap-2 px-3 py-2">
        <Languages className="h-4 w-4 shrink-0 text-slate-400" />
        <div className="flex gap-1" role="group" aria-label={t("app.language")}>
          {LOCALES.map((option) => (
            <button
              key={option}
              onClick={() => selectLocale(option)}
              disabled={isPending}
              aria-pressed={option === locale}
              className={`rounded px-2 py-1 text-xs font-medium transition disabled:opacity-60 ${
                option === locale
                  ? "bg-slate-700 text-white"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              {LOCALE_LABELS[option]}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-0.5"
      role="group"
      aria-label={t("app.language")}
    >
      {LOCALES.map((option) => (
        <button
          key={option}
          onClick={() => selectLocale(option)}
          disabled={isPending}
          aria-pressed={option === locale}
          title={LOCALE_LABELS[option]}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition disabled:opacity-60 ${
            option === locale
              ? "bg-slate-800 text-white"
              : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
          }`}
        >
          {option.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
