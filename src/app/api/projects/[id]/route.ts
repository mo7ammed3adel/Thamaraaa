import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkProjectBlockers } from "@/lib/distribution";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const project = await prisma.project.findUnique({
      where: { id: params.id },
      include: {
        accountManager: { select: { name: true, role: true } },
        headTechnical: { select: { name: true, role: true } },
        headSeo: { select: { name: true, role: true } },
        deal: {
          include: {
            lead: {
              include: {
                callLogs: { include: { agent: { select: { name: true, role: true } } }, orderBy: { createdAt: "asc" } },
                meetings: { include: { teleAgent: { select: { name: true } }, salesAgent: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
                deals: { include: { salesAgent: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
              }
            },
            salesAgent: { select: { name: true, role: true } },
            installments: true
          }
        },
        tasks: {
          include: {
            leader: { select: { name: true, role: true } },
            agent: { select: { name: true, role: true } }
          },
          orderBy: { createdAt: "asc" }
        },
        globalNotes: {
          orderBy: { createdAt: "desc" }
        },
        files: true,
        logs: true
      }
    });

    if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ project });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();

    if (body.projectStatus && ["in_progress", "completed", "review"].includes(body.projectStatus)) {
      const blockers = await checkProjectBlockers(params.id);
      if (blockers.isBlocked) {
        return NextResponse.json({ 
          error: "Action blocked by unresolved warnings.", 
          warnings: blockers.warnings 
        }, { status: 403 });
      }
    }

    const project = await prisma.project.update({
      where: { id: params.id },
      data: body
    });

    return NextResponse.json({ success: true, project });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
