export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson, unauthorizedJson } from "@/server/http/responses";
import { prisma } from "@/lib/prisma";
import { normalizeWebUrl } from "@/lib/safe-url";

const HR_ROLES = ["super_admin", "hr_manager"];
const VISIBILITY = ["hr_only", "dept_head", "team_leader", "everyone"];

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorizedJson();
  const isHr = HR_ROLES.includes(user.role || "");

  try {
    const complaints = await prisma.hrComplaint.findMany({
      where: isHr ? {} : { userId: user.id },
      include: { notes: { orderBy: { createdAt: "asc" } } },
      orderBy: { createdAt: "desc" },
    });
    const names = new Map(
      (await prisma.user.findMany({ where: { id: { in: complaints.map((c) => c.userId) } }, select: { id: true, name: true } }))
        .map((u) => [u.id, u.name])
    );
    return successJson({ complaints: complaints.map((c) => ({ ...c, employeeName: names.get(c.userId) || "Unknown" })) });
  } catch (e: unknown) {
    console.error("Complaints GET error:", e instanceof Error ? e.message : e);
    return errorJson("Internal Server Error", 500);
  }
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorizedJson();

  const body = await req.json().catch(() => null);
  const subject = typeof body?.subject === "string" ? body.subject.trim() : "";
  const details = typeof body?.details === "string" ? body.details.trim() : "";
  const visibility = VISIBILITY.includes(body?.visibility) ? body.visibility : "hr_only";
  const attachmentUrl = body?.attachmentUrl ? normalizeWebUrl(body.attachmentUrl) : null;
  if (!subject || !details) return errorJson("Subject and details are required", 400);

  try {
    const complaint = await prisma.hrComplaint.create({
      data: { userId: user.id, subject: subject.slice(0, 160), details, visibility, attachmentUrl },
    });
    const hr = await prisma.user.findFirst({ where: { role: "hr_manager", status: "Active" }, select: { id: true } });
    if (hr) {
      await prisma.notification.create({
        data: { userId: hr.id, title: "New Complaint", message: `${user.name} submitted a complaint: ${subject.slice(0, 60)}`, link: "/dashboard/hr" },
      });
    }
    return successJson({ complaint }, 201);
  } catch (e: unknown) {
    console.error("Complaints POST error:", e instanceof Error ? e.message : e);
    return errorJson("Internal Server Error", 500);
  }
}
