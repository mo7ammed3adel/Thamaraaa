import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    
    // Only telesales agents or admins can create leads manually
    if (!user || (user.role !== "tele_sales_agent" && user.role !== "super_admin" && user.role !== "tele_sales_manager")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const data = await req.json();
    const { name, phone, storeLink, niche, classification, assignedTeleAgentId, status } = data;

    if (!name || !phone) {
      return NextResponse.json({ error: "Name and phone are required" }, { status: 400 });
    }

    const lead = await prisma.lead.create({
      data: {
        name,
        phone,
        storeLink: storeLink || null,
        niche: niche || null,
        classification: classification || "Cold",
        assignedTeleAgentId: assignedTeleAgentId || user.id,
        status: status || "New",
      },
      select: {
        id: true,
        name: true,
        phone: true,
        storeLink: true,
        niche: true,
        createdAt: true,
      }
    });

    return NextResponse.json(lead, { status: 201 });
  } catch (error) {
    console.error("Error creating lead:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
