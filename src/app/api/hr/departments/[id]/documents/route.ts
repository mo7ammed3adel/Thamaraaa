export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson, unauthorizedJson } from "@/server/http/responses";
import { prisma } from "@/lib/prisma";
import { normalizeWebUrl } from "@/lib/safe-url";

const HR_ROLES = ["super_admin", "hr_manager"];

async function requireHr() {
  const user = await getSessionUser();
  if (!user) return { error: unauthorizedJson() };
  if (!HR_ROLES.includes(user.role || "")) return { error: errorJson("Forbidden", 403) };
  return { user };
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireHr();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const fileUrl = body?.fileUrl ? normalizeWebUrl(body.fileUrl) : null;
  if (!name || !fileUrl) return errorJson("Document name and a valid file URL are required", 400);

  try {
    const document = await prisma.departmentDocument.create({
      data: { departmentId: params.id, name: name.slice(0, 160), fileUrl },
    });
    return successJson({ document }, 201);
  } catch (e: unknown) {
    console.error("Department document POST error:", e instanceof Error ? e.message : e);
    return errorJson("Internal Server Error", 500);
  }
}

export async function DELETE(req: NextRequest) {
  const { error } = await requireHr();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const docId = searchParams.get("docId");
  if (!docId) return errorJson("docId is required", 400);

  try {
    await prisma.departmentDocument.delete({ where: { id: docId } });
    return successJson({ success: true });
  } catch (e: unknown) {
    console.error("Department document DELETE error:", e instanceof Error ? e.message : e);
    return errorJson("Internal Server Error", 500);
  }
}
