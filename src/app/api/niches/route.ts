import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    if (!user || !["super_admin", "tele_sales_manager", "tele_sales_agent"].includes(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const niches = await prisma.niche.findMany({
      orderBy: { name: "asc" }
    });
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
    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Invalid niche name" }, { status: 400 });
    }

    // Standardize: trim and title case
    const standardizedName = name.trim().replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());

    const newNiche = await prisma.niche.upsert({
      where: { name: standardizedName },
      update: {}, // if it exists, do nothing
      create: { name: standardizedName }
    });

    return NextResponse.json({ success: true, niche: newNiche });
  } catch (error: any) {
    console.error("Error creating niche:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
