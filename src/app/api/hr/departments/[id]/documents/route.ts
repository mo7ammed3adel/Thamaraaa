export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson, unauthorizedJson } from "@/server/http/responses";
import { addDepartmentDocument, removeDepartmentDocument } from "@/server/services/hrService";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return unauthorizedJson();

  const body = await req.json().catch(() => null);

  try {
    const result = await addDepartmentDocument({ user, departmentId: params.id, body });
    if (result.status === "forbidden") return errorJson("Forbidden", 403);
    if (result.status === "missing_fields") {
      return errorJson("Document name and a valid file URL are required", 400);
    }
    return successJson({ document: result.document }, 201);
  } catch (e: unknown) {
    console.error("Department document POST error:", e instanceof Error ? e.message : e);
    return errorJson("Internal Server Error", 500);
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorizedJson();

  const { searchParams } = new URL(req.url);
  const docId = searchParams.get("docId");
  if (!docId) return errorJson("docId is required", 400);

  try {
    const result = await removeDepartmentDocument({ user, docId });
    if (result.status === "forbidden") return errorJson("Forbidden", 403);
    return successJson({ success: true });
  } catch (e: unknown) {
    console.error("Department document DELETE error:", e instanceof Error ? e.message : e);
    return errorJson("Internal Server Error", 500);
  }
}
