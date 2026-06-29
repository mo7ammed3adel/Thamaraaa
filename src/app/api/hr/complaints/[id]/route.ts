export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson, unauthorizedJson } from "@/server/http/responses";
import { prisma } from "@/lib/prisma";

const HR_ROLES = ["super_admin", "hr_manager"];
const STATUSES = ["open", "in_progress", "resolved", "closed"];

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return unauthorizedJson();
  if (!HR_ROLES.includes(user.role || "")) return errorJson("Forbidden", 403);

  const body = await req.json().catch(() => null);

  try {
    const data: any = {};
    if (body?.status) {
      if (!STATUSES.includes(body.status)) return errorJson("Invalid status", 400);
      data.status = body.status;
    }
    if (Object.keys(data).length > 0) {
      await prisma.hrComplaint.update({ where: { id: params.id }, data });
    }
    if (typeof body?.note === "string" && body.note.trim()) {
      await prisma.hrComplaintNote.create({ data: { complaintId: params.id, authorId: user.id, note: body.note.trim() } });
    }
    const complaint = await prisma.hrComplaint.findUnique({ where: { id: params.id }, include: { notes: { orderBy: { createdAt: "asc" } } } });
    return successJson({ complaint });
  } catch (e: unknown) {
    console.error("Complaint PATCH error:", e instanceof Error ? e.message : e);
    return errorJson("Internal Server Error", 500);
  }
}
