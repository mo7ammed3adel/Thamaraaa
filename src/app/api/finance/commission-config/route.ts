export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson } from "@/server/http/responses";
import { prisma } from "@/lib/prisma";
import {
  COMMISSION_PARAMS_KEY,
  COMMISSION_RATE_KEYS,
  DEFAULT_COMMISSION_PARAMS,
  recomputeMonth,
  recomputeTelesalesBonuses,
} from "@/lib/commissions";
import { safeTrigger } from "@/lib/pusher";

const FINANCE_ROLES = ["super_admin", "accountant"];
const RATE_KEYS = new Set<string>(Object.values(COMMISSION_RATE_KEYS));

function isValidParams(value: string): boolean {
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return false;
    // Every provided key must be a known param and a finite number.
    return Object.entries(parsed).every(
      ([key, v]) => key in DEFAULT_COMMISSION_PARAMS && Number.isFinite(Number(v))
    );
  } catch {
    return false;
  }
}

function isValidRateTable(value: string): boolean {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed) || parsed.length === 0) return false;
    return parsed.every(
      (tier) =>
        tier &&
        typeof tier === "object" &&
        Number.isFinite(Number(tier.min)) &&
        Number.isFinite(Number(tier.pct)) &&
        Number(tier.pct) >= 0 &&
        Number(tier.pct) <= 1 &&
        (tier.max === null || tier.max === undefined || tier.max === "" || Number.isFinite(Number(tier.max)))
    );
  } catch {
    return false;
  }
}

/**
 * PATCH /api/finance/commission-config — accountant (or super_admin) edits a
 * commission rate table or the gateway fee. Persists to SystemConfig and
 * immediately recomputes the current month so payouts reflect the new rates.
 * Body: { key, value } where value is a JSON string (rate table) or decimal (fee).
 */
export async function PATCH(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || !FINANCE_ROLES.includes(user.role || "")) {
    return errorJson("Forbidden", 403);
  }

  const body = await req.json().catch(() => null);
  const key = typeof body?.key === "string" ? body.key : "";
  const value = typeof body?.value === "string" ? body.value : "";
  if (!key || !value) return errorJson("key and value (string) are required", 400);

  if (RATE_KEYS.has(key)) {
    if (!isValidRateTable(value)) {
      return errorJson("Rate table must be a JSON array of { min, max, pct }, with pct between 0 and 1", 400);
    }
  } else if (key === COMMISSION_PARAMS_KEY) {
    if (!isValidParams(value)) {
      return errorJson("Formula parameters must be a JSON object of known numeric keys", 400);
    }
  } else if (key === "gateway_fee_pct") {
    const fee = parseFloat(value);
    if (Number.isNaN(fee) || fee < 0 || fee >= 1) {
      return errorJson("gateway_fee_pct must be a decimal between 0 and 1", 400);
    }
  } else {
    return errorJson("Unsupported commission config key", 400);
  }

  try {
    await prisma.systemConfig.upsert({
      where: { key },
      update: { value, updatedById: user.id },
      create: { key, value, updatedById: user.id },
    });

    const month = new Date().toISOString().slice(0, 7);
    let recomputed = false;
    try {
      await Promise.all([recomputeMonth(month), recomputeTelesalesBonuses(month)]);
      recomputed = true;
      await safeTrigger("finance-channel", "config-updated", { key, month });
    } catch (e) {
      console.error("Recompute after commission-config change failed:", e);
    }

    return successJson({ ok: true, recomputed });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Commission config PATCH error:", msg);
    return errorJson("Internal Server Error", 500);
  }
}
