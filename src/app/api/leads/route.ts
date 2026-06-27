import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { normalizeWebUrl } from "@/lib/safe-url";
import { getActiveSessionUser } from "@/lib/activeSessionUser";
import { resolveManualLeadAssigneeId } from "@/lib/manualLeadAssignment";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const sessionUser = session?.user as any;
    const user = await getActiveSessionUser(sessionUser);
    
    // Only telesales agents or admins can create leads manually
    if (!user || (user.role !== "tele_sales_agent" && user.role !== "super_admin" && user.role !== "tele_sales_manager")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const data = await req.json();
    const { name, phone, storeLink, niche, classification, assignedTeleAgentId, status } = data;

    if (!name || !phone) {
      return NextResponse.json({ error: "Name and phone are required" }, { status: 400 });
    }

    const safeStoreLink = storeLink ? normalizeWebUrl(storeLink) : null;
    if (storeLink && !safeStoreLink) {
      return NextResponse.json({ error: "storeLink must be a valid http(s) URL" }, { status: 400 });
    }

    let sourceName = `Manual - ${user.name}`;
    if (user.role === "super_admin" || user.role === "tele_sales_manager") {
       // Just appending role if it's not a generic telesales agent to be clear
       sourceName = `Manual (${user.role.replace(/_/g, ' ')}) - ${user.name}`;
    }

    const finalTeleAgentId = resolveManualLeadAssigneeId({
      creatorId: user.id,
      creatorRole: user.role,
      requestedTeleAgentId: assignedTeleAgentId,
    });

    if (finalTeleAgentId && user.role === "tele_sales_manager") {
      const targetAgent = await prisma.user.findUnique({
        where: { id: finalTeleAgentId },
        select: { role: true, status: true, directManagerId: true },
      });
      if (
        !targetAgent ||
        targetAgent.role !== "tele_sales_agent" ||
        targetAgent.status !== "Active" ||
        targetAgent.directManagerId !== user.id
      ) {
        return NextResponse.json({ error: "Invalid TeleSales assignee" }, { status: 400 });
      }
    }
    if (finalTeleAgentId && user.role === "super_admin") {
      const targetAgent = await prisma.user.findUnique({
        where: { id: finalTeleAgentId },
        select: { role: true, status: true },
      });
      if (!targetAgent || targetAgent.role !== "tele_sales_agent" || targetAgent.status !== "Active") {
        return NextResponse.json({ error: "Invalid TeleSales assignee" }, { status: 400 });
      }
    }

    const lead = await prisma.lead.create({
      data: {
        name,
        phone,
        storeLink: safeStoreLink,
        niche: niche || null,
        classification: classification || "Cold",
        assignedTeleAgentId: finalTeleAgentId,
        createdById: user.id,
        source: sourceName,
        status: status || "New",
      },
      select: {
        id: true,
        name: true,
        phone: true,
        storeLink: true,
        source: true,
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
