import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * POST /api/projects/setup
 * Creates a new project from a closed deal and notifies Head Account Managers.
 * The project starts UNASSIGNED (no AM, no Head Technical) —
 * the Head Account Manager will distribute it manually.
 *
 * Body: { dealId: string, niche?: string, deadline?: string }
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const { dealId, niche, deadline } = await request.json();
    if (!dealId) {
      return NextResponse.json({ error: "Deal ID is required" }, { status: 400 });
    }

    // Prevent duplicate projects for the same deal
    const existingProject = await prisma.project.findFirst({ where: { dealId } });
    if (existingProject) {
      return NextResponse.json({ error: "A project already exists for this deal", project: existingProject }, { status: 409 });
    }

    // Fetch the deal to get package info
    const dealData = await prisma.deal.findUnique({
      where: { id: dealId },
      include: { lead: { select: { name: true } } },
    });
    if (!dealData) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    const packageName = dealData.package;

    const newProject = await prisma.project.create({
      data: {
        dealId,
        accountManagerId: null,
        headTechnicalId: null,
        niche: niche || null,
        package: packageName,
        technicalDeadline: deadline ? new Date(deadline) : null,
        finalDeadline: deadline ? new Date(deadline) : null,
        projectStatus: "new",
        lifecycleState: "Onboarding",
      }
    });

    // Log the setup
    await prisma.projectLog.create({
      data: {
        projectId: newProject.id,
        action: "setup",
        details: `Project created from deal. Package: ${packageName}. Awaiting Head AM distribution.`,
        userId,
      }
    });

    // Notify ALL Head Account Managers so they can pick it up
    const headAccountManagers = await prisma.user.findMany({
      where: { role: "head_account_manager", status: "Active" },
      select: { id: true },
    });

    const clientName = dealData.lead?.name || "Unknown Client";

    const notificationPromises = headAccountManagers.map((ham) =>
      prisma.notification.create({
        data: {
          userId: ham.id,
          title: "New Project Awaiting Distribution",
          message: `A new project for "${clientName}" (${packageName}) is ready for assignment.`,
          type: "deal_closed",
          link: "/dashboard/head-account-manager",
        },
      })
    );

    // Also notify via Pusher for real-time updates
    try {
      const { pusherServer } = await import("@/lib/pusher");
      if (pusherServer) {
        const pusherPromises = headAccountManagers.map((ham) =>
          pusherServer.trigger(`user-${ham.id}`, "new-notification", {
            title: "New Project Awaiting Distribution",
            message: `A new project for "${clientName}" (${packageName}) is ready for assignment.`,
            link: "/dashboard/head-account-manager",
          })
        );
        await Promise.all([...notificationPromises, ...pusherPromises]);
      } else {
        await Promise.all(notificationPromises);
      }
    } catch {
      await Promise.all(notificationPromises);
    }

    return NextResponse.json(newProject, { status: 201 });
  } catch (error) {
    console.error("Failed to setup project:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

