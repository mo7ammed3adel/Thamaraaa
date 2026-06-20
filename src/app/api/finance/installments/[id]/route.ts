import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user?.role !== "accountant" && session.user?.role !== "super_admin")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { isPaid } = body;
    if (typeof isPaid !== "boolean") {
      return NextResponse.json({ error: "isPaid must be boolean" }, { status: 400 });
    }

    const existing = await prisma.installment.findUnique({
      where: { id: params.id },
      include: { deal: { include: { projects: { select: { id: true } } } } },
    });

    if (!existing) {
      return NextResponse.json({ error: "Installment not found" }, { status: 404 });
    }

    const installment = await prisma.$transaction(async (tx) => {
      const updated = await tx.installment.update({
        where: { id: params.id },
        data: { isPaid },
        include: { deal: true }
      });

      const projectId = existing.deal.projects[0]?.id;
      if (projectId) {
        await tx.projectLog.create({
          data: {
            projectId,
            userId: (session.user as any).id,
            action: "installment_updated",
            details: `Installment ${params.id} marked as ${isPaid ? "paid" : "unpaid"}. Amount: ${existing.amount} SAR`,
          },
        });
      }

      return updated;
    });
     
    return NextResponse.json({ success: true, installment });
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
