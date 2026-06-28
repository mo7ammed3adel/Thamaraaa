export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson, unauthorizedJson } from "@/server/http/responses";
import {
  listOnboarding,
  manageOnboarding,
  removeOnboarding,
  toggleOnboarding,
} from "@/server/services/hrService";

export async function GET(req: NextRequest) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return unauthorizedJson();

  const { searchParams } = new URL(req.url);
  try {
    const tasks = await listOnboarding({
      sessionUserId: sessionUser.id,
      sessionUserRole: sessionUser.role,
      targetUserId: searchParams.get("userId"),
    });
    return successJson({ tasks });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("HR onboarding GET error:", msg);
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
    const result = await manageOnboarding({ sessionUserRole: sessionUser.role, body });
    if (result.status === "unauthorized") return errorJson("Forbidden", 403);
    if (result.status === "missing_fields") return errorJson("Missing required fields", 400);
    if (result.status === "invalid_action") return errorJson("Invalid action", 400);
    if (result.status === "already_seeded") return errorJson("Checklist already exists for this kind", 409);
    return successJson({ success: true }, 201);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("HR onboarding POST error:", msg);
    return errorJson("Internal Server Error", 500);
  }
}

export async function PATCH(req: NextRequest) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return unauthorizedJson();

  let body: any;
  try {
    body = await req.json();
  } catch {
    return errorJson("Invalid JSON body", 400);
  }

  try {
    const result = await toggleOnboarding({ sessionUserRole: sessionUser.role, body });
    if (result.status === "unauthorized") return errorJson("Forbidden", 403);
    if (result.status === "missing_fields") return errorJson("id is required", 400);
    if (result.status === "not_found") return errorJson("Task not found", 404);
    return successJson({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("HR onboarding PATCH error:", msg);
    return errorJson("Internal Server Error", 500);
  }
}

export async function DELETE(req: NextRequest) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return unauthorizedJson();

  const { searchParams } = new URL(req.url);
  try {
    const result = await removeOnboarding({ sessionUserRole: sessionUser.role, id: searchParams.get("id") });
    if (result.status === "unauthorized") return errorJson("Forbidden", 403);
    if (result.status === "missing_fields") return errorJson("id is required", 400);
    return successJson({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("HR onboarding DELETE error:", msg);
    return errorJson("Internal Server Error", 500);
  }
}
