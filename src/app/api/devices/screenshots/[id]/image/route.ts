import { getSessionUser } from "@/server/auth/session";
import { errorJson, unauthorizedJson } from "@/server/http/responses";
import { getScreenshotForView } from "@/server/services/deviceMonitoringService";
import { readScreenshotFile } from "@/server/services/screenshotStorage";

export const runtime = "nodejs";

/**
 * GET /api/devices/screenshots/[id]/image — streams the JPEG.
 * Screenshots live outside the public tree, so every view is authorized here
 * rather than served as a static asset.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user?.role) return unauthorizedJson();

  const result = await getScreenshotForView({ actorRole: user.role, id: params.id });
  if (result.status === "forbidden") return errorJson("Forbidden", 403);
  if (result.status === "not_found") return errorJson("Not found", 404);

  try {
    const data = await readScreenshotFile(result.storageKey);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return errorJson("Image unavailable", 404);
  }
}
