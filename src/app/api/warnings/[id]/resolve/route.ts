import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const warning = await prisma.warning.update({
      where: { id: params.id },
      data: { status: "Resolved" }
    });
    return NextResponse.json({ success: true, warning });
  } catch (err) {
    return NextResponse.json({ error: "Failed to resolve warning" }, { status: 500 });
  }
}
