import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canDistributeTo, backfillReceiptsForNewMember } from "@/lib/distribution";
import { safeTrigger } from "@/lib/pusher";

/**
 * POST /api/projects/distribute
 * Distributes (assigns) a project to an Account Manager or Head Technical.
 * Head Account Manager assigns account_manager → updates Project.accountManagerId
 * Head Account Manager assigns head_technical → updates Project.headTechnicalId
 * Body: { projectId: string, targetUserId: string }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as { id: string; role: string; name: string };
    const body = await req.json();
    const { projectId, targetUserId } = body;

    if (!projectId || !targetUserId) {
      return NextResponse.json(
        { error: "projectId and targetUserId are required" },
        { status: 400 }
      );
    }

    // Fetch target user to determine their role
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, role: true, name: true, status: true },
    });

    if (!targetUser || targetUser.status !== "Active") {
      return NextResponse.json(
        { error: "Target user not found or inactive" },
        { status: 404 }
      );
    }

    // Check distribution permission
    if (!canDistributeTo(user.role, targetUser.role)) {
      return NextResponse.json(
        { error: `Your role (${user.role}) cannot distribute to ${targetUser.role}` },
        { status: 403 }
      );
    }

    // Fetch the project
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, accountManagerId: true, headTechnicalId: true, headSeoId: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (user.role === "account_manager" && project.accountManagerId !== user.id) {
      return NextResponse.json({ error: "You can only distribute your own projects" }, { status: 403 });
    }
    if (user.role === "head_technical" && project.headTechnicalId !== user.id) {
      return NextResponse.json({ error: "You can only distribute projects assigned to you as Head Technical" }, { status: 403 });
    }
    if (user.role === "head_seo" && project.headSeoId !== user.id) {
      return NextResponse.json({ error: "You can only distribute projects assigned to you as Head SEO" }, { status: 403 });
    }

    // Determine which field to update based on target role
    const updateData: Record<string, unknown> = {};
    let assignmentDescription = "";

    if (targetUser.role === "account_manager") {
      updateData.accountManagerId = targetUser.id;
      assignmentDescription = `Account Manager assigned: ${targetUser.name}`;
    } else if (targetUser.role === "head_technical") {
      updateData.headTechnicalId = targetUser.id;
      assignmentDescription = `Head Technical assigned: ${targetUser.name}`;
    } else if (targetUser.role === "head_seo") {
      updateData.headSeoId = targetUser.id;
      assignmentDescription = `Head SEO assigned: ${targetUser.name}`;
    } else {
      // For team leaders / agents, create a TeamAssignment record
      const existingAssignment = await prisma.teamAssignment.findUnique({
        where: { projectId_userId: { projectId, userId: targetUser.id } },
      });

      if (existingAssignment) {
        return NextResponse.json(
          { error: `${targetUser.name} is already assigned to this project` },
          { status: 409 }
        );
      }

      // Map role to department
      const roleToDepartment: Record<string, string> = {
        team_leader_social_media: "social_media",
        agent_social_media: "social_media",
        team_leader_media_buyer: "media_buyer",
        agent_media_buyer: "media_buyer",
        team_leader_seo: "seo",
        agent_seo: "seo",
        agent_content_seo: "content_seo",
        leader_graphic_designer: "graphic_design",
        agent_graphic_designer: "graphic_design",
        leader_motion_graphic: "motion_graphic",
        agent_motion_graphic: "motion_graphic",
        leader_ui: "ui_design",
        agent_ui: "ui_design",
      };

      const department = roleToDepartment[targetUser.role] || "general";

      await prisma.teamAssignment.create({
        data: {
          projectId,
          userId: targetUser.id,
          assignedByUserId: user.id,
          role: targetUser.role,
          department,
        },
      });

      // Ensure the new member receives any unresolved warnings on this project
      await backfillReceiptsForNewMember(projectId, targetUser.id);

      // Also create audit log
      await prisma.projectLog.create({
        data: {
          projectId,
          action: "team_assigned",
          details: JSON.stringify({
            assignedUser: targetUser.name,
            assignedRole: targetUser.role,
            department,
            assignedBy: user.name,
          }),
          userId: user.id,
        },
      });

      // Automatically generate tasks to bootstrap the workflow if assigning a leader
      if (targetUser.role.includes("leader") || targetUser.role.includes("head")) {
        try {
          const reqHost = req.headers.get("x-forwarded-host") || req.nextUrl.host;
          const reqProtocol = req.headers.get("x-forwarded-proto") || req.nextUrl.protocol;
          
          await fetch(`${reqProtocol}//${reqHost}/api/tasks/generate`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              cookie: req.headers.get("cookie") || "",
            },
            body: JSON.stringify({
              projectId,
              packageType: department === "social_media" || department === "media_buyer" ? department : "general",
              socialLeaderId: department === "social_media" ? targetUser.id : undefined,
              mediaLeaderId: department === "media_buyer" ? targetUser.id : undefined,
              seoLeaderId: department === "seo" ? targetUser.id : undefined,
            }),
          });
        } catch (e) {
          console.error("Auto task generation failed:", e);
        }
      }

      // Send real-time notification
      await safeTrigger("projects-channel", "team-assigned", {
        projectId,
        userId: targetUser.id,
        role: targetUser.role,
        assignedBy: user.name,
      });

      // Send notification to the assigned user
      await prisma.notification.create({
        data: {
          userId: targetUser.id,
          title: "New Project Assignment",
          message: `You have been assigned to a project by ${user.name}`,
          type: "project_assigned",
          link: `/dashboard/operations`,
        },
      });

      return NextResponse.json({
        success: true,
        assignment: { projectId, userId: targetUser.id, department },
      });
    }

    // For account_manager / head_technical / head_seo field updates
    if (Object.keys(updateData).length > 0) {
      updateData.assignedAt = new Date();

      await prisma.$transaction([
        prisma.project.update({ where: { id: projectId }, data: updateData }),
        prisma.projectLog.create({
          data: {
            projectId,
            action: "assigned",
            details: JSON.stringify({
              description: assignmentDescription,
              assignedBy: user.name,
              assignedByRole: user.role,
            }),
            userId: user.id,
          },
        }),
      ]);

      // Make sure the newly-assigned manager sees any unresolved warnings on this project
      await backfillReceiptsForNewMember(projectId, targetUser.id);

      // Send notification to the assigned user
      await prisma.notification.create({
        data: {
          userId: targetUser.id,
          title: "New Project Assigned",
          message: `${assignmentDescription} by ${user.name}`,
          type: "project_assigned",
          link: `/dashboard/operations`,
        },
      });

      // Real-time update
      await safeTrigger("projects-channel", "project-distributed", {
        projectId,
        assignedTo: targetUser.name,
        assignedToRole: targetUser.role,
        assignedBy: user.name,
      });

      return NextResponse.json({
        success: true,
        project: { id: projectId, ...updateData },
      });
    }

    return NextResponse.json({ error: "No distribution rule for this role" }, { status: 400 });
  } catch (error: unknown) {
    console.error("Distribution error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
