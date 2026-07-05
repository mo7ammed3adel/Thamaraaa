import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { saveSystemConfig } from "@/server/services/settingsService";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const adminId = (session?.user as any)?.id;
    if ((session?.user as any)?.role !== "super_admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { key, value } = await req.json();

    const result = await saveSystemConfig({ adminId, key, value });

    if (result.status === "missing_fields") {
      return NextResponse.json({ error: "key and value (string) are required" }, { status: 400 });
    }
    if (result.status === "invalid_value") {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({ ...result.config, recomputed: result.recomputed }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
