import { DEFAULT_LOCALE, type Locale } from "./config";
import { MESSAGES, type MessageKey } from "./messages";

export type Translator = (key: MessageKey, params?: Record<string, string | number>) => string;

/**
 * Builds the `t` function for a locale.
 *
 * A key with no translation falls back to the default locale, then to the key
 * itself — a screen never renders blank because a string was missed.
 * `{name}` placeholders are substituted from `params`.
 *
 * Pure, so it can be unit-tested and used from both server and client code.
 */
export function createTranslator(locale: Locale): Translator {
  const dictionary = MESSAGES[locale] ?? MESSAGES[DEFAULT_LOCALE];
  const fallback = MESSAGES[DEFAULT_LOCALE];

  return (key, params) => {
    const template = dictionary[key] ?? fallback[key] ?? key;
    if (!params) return template;

    return Object.entries(params).reduce(
      (text, [name, value]) => text.split(`{${name}}`).join(String(value)),
      template
    );
  };
}
