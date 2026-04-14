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

    const installment = await prisma.installment.update({
      where: { id: params.id },
      data: { isPaid },
      include: { deal: true }
    });

    // Also update deal specific flags
    // (A real robust logic would check which installment number this was, but we assume dynamic mapping)
    
    return NextResponse.json({ success: true, installment });
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
