export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson, unauthorizedJson } from "@/server/http/responses";
import { createHrmResource } from "@/server/services/hrmService";
import { prisma } from "@/lib/prisma";

const HR_ROLES = ["super_admin", "hr_manager"];

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorizedJson();

  const isHr = HR_ROLES.includes(user.role || "");
  const [requestTypes, requests] = await Promise.all([
    prisma.hrRequestType.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.hrRequest.findMany({
      where: isHr ? {} : { userId: user.id },
      include: { timeline: { orderBy: { createdAt: "asc" } }, comments: { orderBy: { createdAt: "asc" } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return successJson({ requestTypes, requests });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorizedJson();

  const body = await req.json().catch(() => null);
  if (!body?.typeKey) return errorJson("Request type is required", 400);

  const request = await createHrmResource({
    actorId: user.id,
    resource: "hrRequest",
    body: {
      ...body,
      userId: user.id,
      status: "submitted",
    },
  });

  return successJson({ request }, 201);
}
