import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson, unauthorizedJson } from "@/server/http/responses";
import { createProjectWarning, listUnreadWarnings } from "@/server/services/warningService";

// POST /api/warnings - Create a new warning
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorizedJson();

    const body = await req.json();
    const result = await createProjectWarning({ actor: user, body });
    if (result.status === "invalid") return errorJson("message and projectId required", 400);
    if (result.status === "project_not_found") return errorJson("Project not found", 404);
    if (result.status === "forbidden") return errorJson("Forbidden: you cannot issue warnings for this project", 403);

    return successJson({ success: true, warning: result.warning });
  } catch (error: any) {
    console.error("Create Warning Error:", error);
    return errorJson("Internal Server Error", 500, { details: error.message });
  }
}

// GET /api/warnings — returns the current user's unread warnings (with sender info).
// Shape matches what WarningPopup / GlobalWarningAlert consume so they can mount-load existing warnings.
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorizedJson();

    const warnings = await listUnreadWarnings(user.id);
    return successJson(warnings);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Fetch Warnings Error:", message);
    return errorJson("Internal Server Error", 500);
  }
}
