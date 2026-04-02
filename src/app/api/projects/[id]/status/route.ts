import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const { projectStatus, finalStatus, notes, details } = await request.json();

    const updateData: any = {};
    if (projectStatus) updateData.projectStatus = projectStatus;
    if (finalStatus) updateData.finalStatus = finalStatus;
    if (notes) updateData.notes = notes;

    const updatedProject = await prisma.project.update({
      where: { id: params.id },
      data: updateData,
    });

    if (projectStatus || finalStatus) {
      await prisma.projectLog.create({
        data: {
          projectId: params.id,
          action: "status_changed",
          details: details || `Status changed to ${projectStatus || finalStatus}`,
          userId
        }
      });
    }

    return NextResponse.json(updatedProject);
  } catch (error) {
    console.error("Failed to update project status:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
