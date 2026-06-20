import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkProjectBlockers, userCanAccessProject } from "@/lib/distribution";

// Fields the project detail PATCH is allowed to mutate. Anything not in this list
// is silently dropped to prevent mass-assignment attacks (e.g. overwriting accountManagerId,
// totals, lifecycleState — those have dedicated endpoints with stricter authz).
const ALLOWED_PATCH_FIELDS = new Set([
  "niche",
  "storeUrl",
  "driveLink",
  "screenshotUrl",
  "notes",
  "priority",
  "projectStatus",
  "technicalDeadline",
  "finalDeadline",
  "addedDurationDays",
  "storeCreated",
  "userCreatedStore",
  "seoProgress",
  "socialMediaProgress",
  "mediaBuyerProgress",
]);

const DATE_FIELDS = new Set(["technicalDeadline", "finalDeadline"]);

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; role: string };

  const allowed = await userCanAccessProject(user.id, user.role, params.id);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
  const user = session.user as { id: string; role: string };

  // Only project stakeholders can edit. Sensitive fields (assignments, lifecycle, billing)
  // have dedicated endpoints — the allow-list below also keeps non-stakeholders from touching anything else.
  const allowed = await userCanAccessProject(user.id, user.role, params.id);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();

    // Build a sanitized data object containing only allow-listed fields.
    const data: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body)) {
      if (!ALLOWED_PATCH_FIELDS.has(key)) continue;
      if (DATE_FIELDS.has(key)) {
        data[key] = value ? new Date(value as string) : null;
      } else {
        data[key] = value;
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No editable fields supplied" }, { status: 400 });
    }

    if (typeof data.projectStatus === "string" && ["in_progress", "completed", "review"].includes(data.projectStatus)) {
      const blockers = await checkProjectBlockers(params.id);
      if (blockers.isBlocked) {
        return NextResponse.json({
          error: "Action blocked by unresolved warnings.",
          warnings: blockers.warnings,
        }, { status: 403 });
      }
    }

    const project = await prisma.project.update({
      where: { id: params.id },
      data,
    });

    return NextResponse.json({ success: true, project });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
