export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { purgeExpiredScreenshots } from "@/server/services/deviceMonitoringService";

function isAuthorizedCronRequest(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) return req.headers.get("authorization") === `Bearer ${secret}`;
  return process.env.NODE_ENV !== "production";
}

/**
 * Deletes screenshots past the retention window the super admin configured.
 * Intended to run daily from the host crontab; safe to run more often, since
 * a pass with nothing expired is a no-op.
 */
export async function GET(req: NextRequest) {
  try {
    if (!isAuthorizedCronRequest(req)) {
      return NextResponse.json({ error: "Unauthorized cron request" }, { status: 401 });
    }

    const { retentionDays, cutoff, deleted, failed, remaining } = await purgeExpiredScreenshots();

    return NextResponse.json({
      success: true,
      retentionDays,
      cutoff: cutoff.toISOString(),
      deleted,
      failed,
      remaining,
    });
  } catch (error: any) {
    console.error("Screenshot retention cron error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
