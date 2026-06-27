import type { CommissionTierDto, FinanceLineItem } from "@/contracts/finance";
import { parseJsonArray, stringifyJson } from "./json";

export function parseCommissionTiers(raw: string | null | undefined): CommissionTierDto[] {
  return parseJsonArray<CommissionTierDto>(raw);
}

export function parseFinanceLineItems(raw: string | null | undefined): FinanceLineItem[] {
  return parseJsonArray<FinanceLineItem>(raw);
}

export function sumFinanceLineItems(raw: string | null | undefined): number {
  return parseFinanceLineItems(raw).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
}

export function stringifyFinanceLineItems(items: FinanceLineItem[]): string {
  return stringifyJson(items);
}
