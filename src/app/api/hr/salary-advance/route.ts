export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson, unauthorizedJson } from "@/server/http/responses";
import { listSalaryAdvances, submitSalaryAdvance } from "@/server/services/hrService";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorizedJson();

  try {
    const advances = await listSalaryAdvances(user);
    return successJson({ advances });
  } catch (e: unknown) {
    console.error("Salary advance GET error:", e instanceof Error ? e.message : e);
    return errorJson("Internal Server Error", 500);
  }
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorizedJson();

  const body = await req.json().catch(() => null);

  try {
    const result = await submitSalaryAdvance({ user, body });
    if (result.status === "missing_fields") {
      return errorJson("A valid amount and reason are required", 400);
    }
    return successJson({ advance: result.advance }, 201);
  } catch (e: unknown) {
    console.error("Salary advance POST error:", e instanceof Error ? e.message : e);
    return errorJson("Internal Server Error", 500);
  }
}
