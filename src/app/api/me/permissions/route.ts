import { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { errorJson, successJson } from "@/server/http/responses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET — the caller's real role and edit/delete grants, read fresh from the
 * database. Uses the JWT identity (not the impersonated session) so a general
 * manager acting as someone else is still judged as themselves. The
 * middleware asks this before letting a general manager change data.
 */
export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.id) return errorJson("Unauthorized", 401);
  const user = await prisma.user.findUnique({
    where: { id: token.id as string },
    select: { role: true, status: true, gmCanEdit: true, gmCanDelete: true },
  });
  if (!user || user.status !== "Active") return errorJson("Unauthorized", 401);
  const isSuper = user.role === "super_admin";
  const isGm = user.role === "general_manager";
  return successJson({
    role: user.role,
    canEdit: isSuper || (isGm ? user.gmCanEdit : true),
    canDelete: isSuper || (isGm ? user.gmCanDelete : true),
  });
}
