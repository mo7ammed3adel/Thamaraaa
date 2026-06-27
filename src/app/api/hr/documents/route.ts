import { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson, unauthorizedJson } from "@/server/http/responses";
import {
  listEmployeeDocuments,
  removeEmployeeDocument,
  uploadEmployeeDocument,
} from "@/server/services/hrService";

const HR_ROLES = ["super_admin", "hr_manager"];

export async function GET(req: NextRequest) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return unauthorizedJson();

  const { searchParams } = new URL(req.url);
  try {
    const result = await listEmployeeDocuments({
      sessionUserId: sessionUser.id,
      sessionUserRole: sessionUser.role,
      userIdParam: searchParams.get("userId"),
    });

    if (result.status === "forbidden") return errorJson("Forbidden", 403);

    return successJson({ documents: result.documents });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("HR documents GET error:", msg);
    return errorJson("Internal Server Error", 500);
  }
}

export async function POST(req: NextRequest) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return unauthorizedJson();

  let body: any;
  try {
    body = await req.json();
  } catch {
    return errorJson("Invalid JSON body", 400);
  }

  try {
    const result = await uploadEmployeeDocument({
      sessionUserId: sessionUser.id,
      sessionUserRole: sessionUser.role,
      body,
    });

    if (result.status === "missing_fields") return errorJson("name and fileUrl are required", 400);
    if (result.status === "upload_forbidden") {
      return errorJson("Forbidden: cannot upload for another user", 403);
    }

    return successJson({ document: result.document }, 201);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("HR documents POST error:", msg);
    return errorJson("Internal Server Error", 500);
  }
}

export async function DELETE(req: NextRequest) {
  const sessionUser = await getSessionUser();
  if (!sessionUser || !HR_ROLES.includes(sessionUser.role || "")) {
    return errorJson("Forbidden", 403);
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return errorJson("id required", 400);

  try {
    await removeEmployeeDocument(id);
    return successJson({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("HR documents DELETE error:", msg);
    return errorJson("Internal Server Error", 500);
  }
}
