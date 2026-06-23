import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  buildNewProjectData,
  projectSetupLogDetails,
  notifyHeadAccountManagersOfNewProject,
} from "@/lib/projectSetup";

/**
 * POST /api/projects/setup
 * Manual recovery endpoint: creates a project for a closed deal that does not yet
 * have one. The happy path now creates the project inside POST /api/deals; this
 * route remains as an idempotent fallback for legacy/orphaned deals.
 * The project starts UNASSIGNED — the Head Account Manager distributes it.
 *
 * Body: { dealId: string, niche?: string, deadline?: string }
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    const userId = user?.id;
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    if (!["sales_agent", "super_admin"].includes(user.role)) {
      return NextResponse.json({ error: "Forbidden: only the closing Sales Agent can create a project from a deal" }, { status: 403 });
    }

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
    if (user.role === "sales_agent" && dealData.salesAgentId !== user.id) {
      return NextResponse.json({ error: "Forbidden: this deal is not assigned to you" }, { status: 403 });
    }

    const packageName = dealData.package;
    const clientName = dealData.lead?.name || "Unknown Client";

    const newProject = await prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: buildNewProjectData(dealData, niche || null, deadline ? new Date(deadline) : null),
      });
      await tx.projectLog.create({
        data: {
          projectId: project.id,
          action: "setup",
          details: projectSetupLogDetails(packageName),
          userId,
        },
      });
      return project;
    });

    // Notify ALL Head Account Managers so they can pick it up (best-effort)
    await notifyHeadAccountManagersOfNewProject(clientName, packageName);

    return NextResponse.json(newProject, { status: 201 });
  } catch (error) {
    console.error("Failed to setup project:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

