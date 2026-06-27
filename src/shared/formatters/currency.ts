export const DEFAULT_CURRENCY = "SAR";

type NumberFormatOptions = Intl.NumberFormatOptions & {
  locale?: string | string[];
};

type CurrencyFormatOptions = NumberFormatOptions & {
  currency?: string;
  placement?: "prefix" | "suffix";
};

export function formatNumber(value: number | null | undefined, options: NumberFormatOptions = {}): string {
  const { locale, ...numberOptions } = options;
  return Number(value ?? 0).toLocaleString(locale, numberOptions);
}

export function formatCurrency(value: number | null | undefined, options: CurrencyFormatOptions = {}): string {
  const { currency = DEFAULT_CURRENCY, placement = "prefix", ...numberOptions } = options;
  const formatted = formatNumber(value, numberOptions);
  return placement === "suffix" ? `${formatted} ${currency}` : `${currency} ${formatted}`;
}

export function formatSar(value: number | null | undefined, options: NumberFormatOptions = {}): string {
  return formatCurrency(value, { ...options, currency: DEFAULT_CURRENCY, placement: "prefix" });
}

export function formatSarSuffix(value: number | null | undefined, options: NumberFormatOptions = {}): string {
  return formatCurrency(value, { ...options, currency: DEFAULT_CURRENCY, placement: "suffix" });
}
