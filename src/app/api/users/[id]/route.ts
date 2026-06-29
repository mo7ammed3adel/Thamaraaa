import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import bcrypt from "bcryptjs";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    
    // Allow HR, Super Admin to edit general details.
    if (!user || (!["super_admin", "hr_manager"].includes(user.role))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = params;
    const body = await req.json();
    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (user.role === "hr_manager") {
      if (targetUser.role === "super_admin" || body.role === "super_admin") {
        return NextResponse.json({ error: "Only Super Admin can create or modify Super Admin accounts" }, { status: 403 });
      }
    }

    const updateData: any = {};
    if (body.directManagerId !== undefined) {
      updateData.directManagerId = body.directManagerId === "" ? null : body.directManagerId;
    }
    if (body.status) updateData.status = body.status;
    if (body.level) updateData.level = body.level;
    if (body.role) updateData.role = body.role;
    if (body.name) updateData.name = body.name;
    if (body.email) updateData.email = body.email;
    if (body.phone !== undefined) updateData.phone = body.phone;
    if (body.password && body.password.trim() !== "") {
      updateData.passwordHash = await bcrypt.hash(body.password, 10);
    }
    if (body.company !== undefined) updateData.company = body.company;
    if (body.companyId !== undefined) {
      if (body.companyId === null || body.companyId === "") {
        updateData.companyId = null;
        updateData.company = null;
      } else {
        const company = await prisma.company.findUnique({ where: { id: body.companyId } });
        if (!company) {
          return NextResponse.json({ error: "Selected company not found" }, { status: 400 });
        }
        updateData.companyId = body.companyId;
        updateData.company = company.name;
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        level: true,
        status: true,
        company: true,
        companyId: true,
        companyRef: { select: { id: true, name: true } },
        directManagerId: true,
        directManager: { select: { id: true, name: true } },
      }
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;

    if (!user || user.role !== "super_admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = params;

    if (id === user.id) {
      return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
    }

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check for hard business references that must be preserved (deals, meetings, callLogs etc.).
    // If any exist we soft-delete (deactivate + free up email/phone) instead of throwing FK errors.
    const [dealCount, meetingCount, callLogCount, projectCount, warningCount, noteCount] = await Promise.all([
      prisma.deal.count({ where: { salesAgentId: id } }),
      prisma.meeting.count({ where: { OR: [{ teleAgentId: id }, { salesAgentId: id }] } }),
      prisma.callLog.count({ where: { agentId: id } }),
      prisma.project.count({ where: { OR: [{ accountManagerId: id }, { headTechnicalId: id }, { headSeoId: id }] } }),
      prisma.warning.count({ where: { senderUserId: id } }),
      prisma.note.count({ where: { userId: id } }),
    ]);

    const hasBusinessHistory =
      dealCount + meetingCount + callLogCount + projectCount + warningCount + noteCount > 0;

    if (hasBusinessHistory) {
      // Soft delete: deactivate and free unique email/phone so they can be reused.
      const stamp = Date.now();
      await prisma.user.update({
        where: { id },
        data: {
          status: "Inactive",
          email: `deleted_${stamp}_${target.email}`.slice(0, 190),
          phone: target.phone ? `deleted_${stamp}_${target.phone}`.slice(0, 190) : null,
          directManagerId: null,
        },
      });
      return NextResponse.json({
        message: "User deactivated (has business history). Records preserved.",
        softDeleted: true,
      });
    }

    // No business history — safe to hard delete. Clean up dependent records first.
    await prisma.$transaction(async (tx) => {
      // Detach from optional FKs (leads created/assigned, subordinates already cascades to SetNull).
      await tx.lead.updateMany({ where: { assignedTeleAgentId: id }, data: { assignedTeleAgentId: null } });
      await tx.lead.updateMany({ where: { assignedSalesAgentId: id }, data: { assignedSalesAgentId: null } });
      await tx.lead.updateMany({ where: { createdById: id }, data: { createdById: null } });

      // Delete dependent records that are safe to remove with the user.
      await tx.notification.deleteMany({ where: { userId: id } });
      await tx.leaveRequest.deleteMany({ where: { userId: id } });
      await tx.attendance.deleteMany({ where: { userId: id } });
      await tx.employeeDocument.deleteMany({ where: { userId: id } });
      await tx.commission.deleteMany({ where: { userId: id } });
      await tx.agentTarget.deleteMany({ where: { agentId: id } });
      await tx.warningReceipt.deleteMany({ where: { userId: id } });
      await tx.teamAssignment.deleteMany({ where: { OR: [{ userId: id }, { assignedByUserId: id }] } });
      await tx.task.updateMany({ where: { agentId: id }, data: { agentId: null } });
      await tx.task.deleteMany({ where: { leaderId: id } });
      await tx.hrRecord.deleteMany({ where: { userId: id } });

      await tx.user.delete({ where: { id } });
    });

    return NextResponse.json({ message: "User deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting user:", error);
    const msg =
      error?.code === "P2003"
        ? "Cannot delete: user is still referenced by other records. Try deactivating instead."
        : error?.message || "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
