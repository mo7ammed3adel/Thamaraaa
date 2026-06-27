import { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson, unauthorizedJson } from "@/server/http/responses";
import { createProjectNote, listProjectNotes } from "@/server/services/notesService";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorizedJson();

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const category = searchParams.get("department") || searchParams.get("category");
  const authorUserId = searchParams.get("author");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "50", 10);

  if (!projectId) return errorJson("projectId required", 400);

  try {
    const result = await listProjectNotes({
      userId: user.id,
      userRole: user.role as string,
      projectId,
      category,
      authorUserId,
      from,
      to,
      page,
      limit,
    });
    if (result.status === "forbidden") return errorJson("Forbidden", 403);

    return successJson({ notes: result.notes, pagination: result.pagination });
  } catch (error) {
    return errorJson("Internal error", 500);
  }
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorizedJson();

  try {
    const body = await req.json();
    const { projectId, content, category } = body;

    if (!projectId || !content) {
      return errorJson("Missing required fields", 400);
    }

    const result = await createProjectNote({
      userId: user.id,
      userRole: user.role as string,
      userName: user.name as string,
      projectId,
      content,
      category,
    });
    if (result.status === "forbidden") return errorJson("Forbidden", 403);

    return successJson({ note: result.note });
  } catch (error) {
    console.error("Failed to create note:", error);
    return errorJson("Internal error", 500);
  }
}
