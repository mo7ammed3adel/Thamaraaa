export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson, unauthorizedJson } from "@/server/http/responses";
import { createReview, listReviews } from "@/server/services/hrService";

export async function GET(req: NextRequest) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return unauthorizedJson();

  const { searchParams } = new URL(req.url);
  try {
    const reviews = await listReviews({
      sessionUserId: sessionUser.id,
      sessionUserRole: sessionUser.role,
      targetUserId: searchParams.get("userId"),
    });
    return successJson({ reviews });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("HR reviews GET error:", msg);
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
    const result = await createReview({
      reviewerId: sessionUser.id,
      reviewerRole: sessionUser.role,
      body,
    });
    if (result.status === "unauthorized") return errorJson("Forbidden", 403);
    if (result.status === "missing_fields") return errorJson("userId, period and rating (1-5) are required", 400);
    return successJson({ review: result.review }, 201);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("HR reviews POST error:", msg);
    return errorJson("Internal Server Error", 500);
  }
}
