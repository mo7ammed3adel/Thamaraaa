"use client";

import { useCallback } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { CHAT_MESSAGES, type ChatMessageKey } from "@/lib/chat/i18n";

export function useChatT() {
  const { locale, dir } = useLocale();
  const t = useCallback((key: ChatMessageKey) => CHAT_MESSAGES[locale][key] ?? CHAT_MESSAGES.en[key], [locale]);
  return { t, locale, dir };
}
