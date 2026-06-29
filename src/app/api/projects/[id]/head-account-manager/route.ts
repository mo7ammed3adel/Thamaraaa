export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson, unauthorizedJson } from "@/server/http/responses";
import { prisma } from "@/lib/prisma";

// Super-admin assigns (or clears) the Head Account Manager for a project/client.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return unauthorizedJson();
  if (user.role !== "super_admin") return errorJson("Forbidden", 403);

  const body = await req.json().catch(() => null);
  const headAccountManagerId: string | null = body?.headAccountManagerId || null;

  try {
    if (headAccountManagerId) {
      const head = await prisma.user.findUnique({
        where: { id: headAccountManagerId },
        select: { role: true, status: true },
      });
      if (!head || head.role !== "head_account_manager" || head.status !== "Active") {
        return errorJson("Invalid head account manager", 400);
      }
    }

    const project = await prisma.project.update({
      where: { id: params.id },
      data: { headAccountManagerId },
      select: {
        id: true,
        headAccountManagerId: true,
        deal: { select: { lead: { select: { name: true } } } },
      },
    });

    if (headAccountManagerId) {
      await prisma.notification.create({
        data: {
          userId: headAccountManagerId,
          title: "New Client Assigned",
          message: `You have been assigned client "${project.deal?.lead?.name || "a client"}".`,
          type: "project_assigned",
          link: "/dashboard/head-account-manager",
        },
      });
    }

    return successJson({ success: true, project });
  } catch (e: unknown) {
    console.error("Assign head account manager error:", e instanceof Error ? e.message : e);
    return errorJson("Internal Server Error", 500);
  }
}
