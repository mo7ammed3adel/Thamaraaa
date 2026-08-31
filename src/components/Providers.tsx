"use client";
import { SessionProvider } from "next-auth/react";
import { ToastViewport } from "@/components/toast";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";

export function Providers({
  children,
  locale = DEFAULT_LOCALE,
}: {
  children: React.ReactNode;
  locale?: Locale;
}) {
  return (
    <SessionProvider>
      <LocaleProvider locale={locale}>
        {children}
        <ToastViewport />
      </LocaleProvider>
    </SessionProvider>
  );
}
