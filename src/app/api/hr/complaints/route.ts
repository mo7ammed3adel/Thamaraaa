export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson, unauthorizedJson } from "@/server/http/responses";
import { listComplaints, submitComplaint } from "@/server/services/hrService";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorizedJson();

  try {
    const complaints = await listComplaints(user);
    return successJson({ complaints });
  } catch (e: unknown) {
    console.error("Complaints GET error:", e instanceof Error ? e.message : e);
    return errorJson("Internal Server Error", 500);
  }
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorizedJson();

  const body = await req.json().catch(() => null);

  try {
    const result = await submitComplaint({ user, body });
    if (result.status === "missing_fields") {
      return errorJson("Subject and details are required", 400);
    }
    return successJson({ complaint: result.complaint }, 201);
  } catch (e: unknown) {
    console.error("Complaints POST error:", e instanceof Error ? e.message : e);
    return errorJson("Internal Server Error", 500);
  }
}
