export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson, unauthorizedJson } from "@/server/http/responses";
import { prisma } from "@/lib/prisma";

// Any logged-in user can set a new password for themselves; clears the
// must-change-password flag (used by the forced first-login flow).
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorizedJson();

  const body = await req.json().catch(() => null);
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";
  if (newPassword.length < 6) {
    return errorJson("New password must be at least 6 characters", 400);
  }

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(newPassword, 10), mustChangePassword: false },
    });
    return successJson({ success: true });
  } catch (e: unknown) {
    console.error("Change password error:", e instanceof Error ? e.message : e);
    return errorJson("Internal Server Error", 500);
  }
}
