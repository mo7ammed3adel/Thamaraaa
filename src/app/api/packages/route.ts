import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { addPackage, listPackages } from "@/server/services/referenceDataService";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const packages = await listPackages();
    return NextResponse.json(packages);
  } catch (error) {
    console.error("Failed to fetch packages:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;
    if (!["super_admin", "head_account_manager"].includes(role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const result = await addPackage(await request.json());
    if (result.status === "missing_fields") {
      return NextResponse.json({ error: "Name and services are required" }, { status: 400 });
    }

    return NextResponse.json(result.pkg);
  } catch (error) {
    console.error("Failed to create package:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
