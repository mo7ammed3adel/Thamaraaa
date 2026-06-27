import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getChiefSalesAnalytics } from "@/server/services/analyticsService";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user?.role !== "chief_sales" && session.user?.role !== "super_admin")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const range = searchParams.get("range") || "all";

  try {
    return NextResponse.json(await getChiefSalesAnalytics(range));
  } catch (error) {
    console.error("Chief Sales API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
