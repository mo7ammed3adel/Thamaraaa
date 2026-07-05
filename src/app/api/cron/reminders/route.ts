export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { sendInstallmentReminders } from "@/server/services/financeService";

function isAuthorizedCronRequest(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) return req.headers.get("authorization") === `Bearer ${secret}`;
  return process.env.NODE_ENV !== "production";
}

// Intended to be run daily via Vercel Cron or external ping
export async function GET(req: NextRequest) {
  try {
    if (!isAuthorizedCronRequest(req)) {
      return NextResponse.json({ error: "Unauthorized cron request" }, { status: 401 });
    }

    const { processedInstallments, notificationsCreated } = await sendInstallmentReminders();

    return NextResponse.json({ success: true, processedInstallments, notificationsCreated });
  } catch (error: any) {
    console.error("Cron Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
