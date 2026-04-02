import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const logs = await prisma.projectLog.findMany({
      where: { projectId: params.id },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json(logs);
  } catch (error) {
    console.error("Failed to fetch project logs:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
