import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, LOCALES, getDirection, normalizeLocale } from "@/lib/i18n/config";
import { MESSAGES, ar, en } from "@/lib/i18n/messages";
import { createTranslator } from "@/lib/i18n/translate";

describe("locale config", () => {
  it("defaults to Arabic", () => {
    expect(DEFAULT_LOCALE).toBe("ar");
  });

  it("falls back to the default for an unknown or missing value", () => {
    expect(normalizeLocale("fr")).toBe(DEFAULT_LOCALE);
    expect(normalizeLocale(undefined)).toBe(DEFAULT_LOCALE);
  });

  it("reads Arabic right-to-left and English left-to-right", () => {
    expect(getDirection("ar")).toBe("rtl");
    expect(getDirection("en")).toBe("ltr");
  });
});

describe("dictionaries", () => {
  it("translates every English key into Arabic", () => {
    const missing = Object.keys(en).filter((key) => !(ar as Record<string, string>)[key]);
    expect(missing).toEqual([]);
  });

  it("has no Arabic key that English does not define", () => {
    const extra = Object.keys(ar).filter((key) => !(en as Record<string, string>)[key]);
    expect(extra).toEqual([]);
  });

  it("leaves no Arabic entry as a copy of the English one", () => {
    // Some values are identical in both languages by nature: initialisms, and
    // example URLs shown verbatim in placeholders.
    const sameInBothLanguages = (value: string) =>
      value === "SEO" || value.startsWith("http");

    const untranslated = Object.keys(en).filter((key) => {
      const english = (en as Record<string, string>)[key];
      return (ar as Record<string, string>)[key] === english && !sameInBothLanguages(english);
    });
    expect(untranslated).toEqual([]);
  });

  it("covers every supported locale", () => {
    for (const locale of LOCALES) expect(MESSAGES[locale]).toBeDefined();
  });
});

describe("translator", () => {
  it("returns the string for the requested locale", () => {
    expect(createTranslator("en")("nav.leads")).toBe("Leads");
    expect(createTranslator("ar")("nav.leads")).toBe("الليدز");
  });

  it("substitutes named parameters", () => {
    const t = createTranslator("en");
    expect(t("nav.leads" as never, { unused: 1 })).toBe("Leads");
  });

  it("falls back to the key itself rather than rendering blank", () => {
    expect(createTranslator("en")("does.not.exist" as never)).toBe("does.not.exist");
  });
});
