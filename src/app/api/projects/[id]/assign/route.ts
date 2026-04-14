import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;

  try {
    const body = await req.json();
    const { targetRole, assigneeId } = body;

    let updateData: any = {};
    let notificationMsg = "";
    
    // Assign Account Manager
    if (targetRole === "account_manager") {
      updateData.accountManagerId = assigneeId;
      updateData.projectStatus = "assigned";
      updateData.assignedAt = new Date();
      notificationMsg = "assigned as Account Manager";
    } 
    // Assign Head Technical
    else if (targetRole === "head_technical") {
      updateData.headTechnicalId = assigneeId;
      notificationMsg = "assigned as Head Technical";
    }
    // Assign Head SEO
    else if (targetRole === "head_seo") {
      updateData.headSeoId = assigneeId;
      notificationMsg = "assigned as Head SEO";
    } else {
      return NextResponse.json({ error: "Invalid targetRole" }, { status: 400 });
    }

    const project = await prisma.project.update({
      where: { id: params.id },
      data: updateData
    });

    // Log the assignment
    await prisma.projectLog.create({
      data: {
        projectId: project.id,
        action: "assigned",
        details: `${targetRole.replace(/_/g, " ").toUpperCase()} assigned to ${assigneeId}`,
        userId: user.id
      }
    });

    return NextResponse.json({ success: true, project });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
