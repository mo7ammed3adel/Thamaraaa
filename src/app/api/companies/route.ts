export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson, unauthorizedJson } from "@/server/http/responses";
import { addCompany, listCompanies } from "@/server/services/referenceDataService";

async function requireSuperAdmin() {
  const user = await getSessionUser();
  if (!user) return { error: unauthorizedJson() };
  if (user.role !== "super_admin") return { error: errorJson("Forbidden", 403) };
  return { user };
}

export async function GET() {
  const { error } = await requireSuperAdmin();
  if (error) return error;

  try {
    const companies = await listCompanies();
    return successJson({ companies });
  } catch (e: unknown) {
    console.error("Companies GET error:", e instanceof Error ? e.message : e);
    return errorJson("Internal Server Error", 500);
  }
}

export async function POST(req: NextRequest) {
  const { error } = await requireSuperAdmin();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return errorJson("Company name is required", 400);

  try {
    const result = await addCompany(name);
    if (result.status === "duplicate_name") {
      return errorJson("A company with this name already exists", 400);
    }
    return successJson({ company: result.company }, 201);
  } catch (e: unknown) {
    console.error("Companies POST error:", e instanceof Error ? e.message : e);
    return errorJson("Internal Server Error", 500);
  }
}
