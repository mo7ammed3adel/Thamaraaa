import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { addNiche, listNiches } from "@/server/services/referenceDataService";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    if (!user || !["super_admin", "tele_sales_manager", "tele_sales_agent"].includes(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const niches = await listNiches();
    return NextResponse.json(niches);
  } catch (error: any) {
    console.error("Error fetching niches:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = session.user as any;
    if (!["super_admin", "tele_sales_manager", "tele_sales_agent"].includes(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { name } = await request.json();
    const result = await addNiche(name);
    if (result.status === "invalid_name") {
      return NextResponse.json({ error: "Invalid niche name" }, { status: 400 });
    }

    return NextResponse.json({ success: true, niche: result.niche });
  } catch (error: any) {
    console.error("Error creating niche:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
