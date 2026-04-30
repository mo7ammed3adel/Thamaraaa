import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const { id } = params;
    if (!id) return NextResponse.json({ error: "Project ID is required" }, { status: 400 });

    const body = await request.json();
    const { niche, storeUrl, driveLink, finalDeadline, notes, projectStatus } = body;

    // Build data object
    const updateData: any = {};
    if (niche !== undefined) updateData.niche = niche;
    if (storeUrl !== undefined) updateData.storeUrl = storeUrl;
    if (driveLink !== undefined) updateData.driveLink = driveLink;
    if (finalDeadline !== undefined) updateData.finalDeadline = finalDeadline ? new Date(finalDeadline) : null;
    if (notes !== undefined) updateData.notes = notes;
    if (projectStatus !== undefined) updateData.projectStatus = projectStatus;

    const project = await prisma.project.update({
      where: { id },
      data: updateData,
    });

    // Log the setup action
    await prisma.projectLog.create({
      data: {
        projectId: id,
        action: "project_setup",
        details: `Initial setup completed by Account Manager. Final Deadline: ${finalDeadline ? new Date(finalDeadline).toLocaleDateString() : 'None'}`,
        userId,
      }
    });

    return NextResponse.json(project);
  } catch (error: any) {
    console.error("Setup project error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
