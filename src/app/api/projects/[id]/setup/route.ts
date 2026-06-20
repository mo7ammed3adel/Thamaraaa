import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { normalizeWebUrl } from "@/lib/safe-url";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    const sessionUser = session?.user as { id?: string; role?: string } | undefined;
    const userId = sessionUser?.id;
    const userRole = sessionUser?.role;
    if (!userId || !userRole) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = params;
    if (!id) return NextResponse.json({ error: "Project ID is required" }, { status: 400 });

    // Setup is performed by the project's Account Manager, the Head Account Manager,
    // or super_admin. Anyone else (including unrelated AMs) is forbidden.
    const ALLOWED_ROLES = ["super_admin", "head_account_manager", "account_manager"];
    if (!ALLOWED_ROLES.includes(userRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (userRole === "account_manager") {
      const project = await prisma.project.findUnique({
        where: { id },
        select: { accountManagerId: true },
      });
      if (!project || project.accountManagerId !== userId) {
        return NextResponse.json({ error: "Forbidden: not your project" }, { status: 403 });
      }
    }

    const body = await request.json();
    const { niche, storeUrl, driveLink, technicalDeadline, finalDeadline, notes, projectStatus } = body;

    const safeStoreUrl = storeUrl ? normalizeWebUrl(storeUrl) : null;
    const safeDriveLink = driveLink ? normalizeWebUrl(driveLink) : null;
    if ((storeUrl && !safeStoreUrl) || (driveLink && !safeDriveLink)) {
      return NextResponse.json({ error: "Project setup links must be valid http(s) URLs" }, { status: 400 });
    }

    // Build data object
    const updateData: any = {};
    if (niche !== undefined) updateData.niche = niche;
    if (storeUrl !== undefined) updateData.storeUrl = safeStoreUrl;
    if (driveLink !== undefined) updateData.driveLink = safeDriveLink;
    if (technicalDeadline !== undefined) updateData.technicalDeadline = technicalDeadline ? new Date(technicalDeadline) : null;
    if (finalDeadline !== undefined) updateData.finalDeadline = finalDeadline ? new Date(finalDeadline) : null;
    if (notes !== undefined) updateData.notes = notes;
    if (projectStatus !== undefined) {
      if (projectStatus !== "setup") {
        return NextResponse.json({ error: "Project setup can only set projectStatus to setup" }, { status: 400 });
      }
      updateData.projectStatus = "setup";
    }

    const project = await prisma.project.update({
      where: { id },
      data: updateData,
    });

    // Log the setup action
    await prisma.projectLog.create({
      data: {
        projectId: id,
        action: "project_setup",
        details: `Initial setup completed by Account Manager. Technical Deadline: ${technicalDeadline ? new Date(technicalDeadline).toLocaleDateString() : 'None'}, Final Deadline: ${finalDeadline ? new Date(finalDeadline).toLocaleDateString() : 'None'}`,
        userId,
      }
    });

    return NextResponse.json(project);
  } catch (error: any) {
    console.error("Setup project error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
