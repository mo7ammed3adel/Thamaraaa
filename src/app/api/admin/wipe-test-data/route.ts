export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { wipeTestData } from "@/server/services/adminDataService";

/**
 * Super-admin-only test-data reset. Authorization uses the raw JWT (getToken),
 * never getServerSession, so an active impersonation overlay can never authorize
 * or perform a wipe — only the real super_admin identity counts.
 */
export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token || token.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Require an explicit confirmation token so a stray or mistaken POST can never
  // wipe the database.
  if (body?.confirm !== "WIPE") {
    return NextResponse.json({ error: "Confirmation required" }, { status: 400 });
  }

  try {
    const result = await wipeTestData();
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Wipe test data error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
