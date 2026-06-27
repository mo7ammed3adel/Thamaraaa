import { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { errorJson, successJson, unauthorizedJson } from "@/server/http/responses";
import { setupExistingProject } from "@/server/services/projectLifecycleService";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getSessionUser();
    if (!user?.id || !user.role) return unauthorizedJson();

    const result = await setupExistingProject({
      projectId: params.id,
      userId: user.id,
      userRole: user.role,
      body: await request.json(),
    });

    if (result.status === "missing_project_id") return errorJson("Project ID is required", 400);
    if (result.status === "forbidden") return errorJson("Forbidden", 403);
    if (result.status === "not_your_project") return errorJson("Forbidden: not your project", 403);
    if (result.status === "invalid_links") {
      return errorJson("Project setup links must be valid http(s) URLs", 400);
    }
    if (result.status === "invalid_setup_status") {
      return errorJson("Project setup can only set projectStatus to setup", 400);
    }

    return successJson(result.project);
  } catch (error: any) {
    console.error("Setup project error:", error);
    return errorJson("Internal Server Error", 500);
  }
}
