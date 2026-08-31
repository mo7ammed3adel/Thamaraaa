import { errorJson, successJson } from "@/server/http/responses";
import { ingestScreenshot } from "@/server/services/deviceMonitoringService";

// Screenshots are binary and can be a few MB; allow a generous body and run on
// the Node runtime so Buffer is available.
export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * POST /api/agent/screenshot
 * One capture from an authenticated agent, sent as multipart/form-data with the
 * JPEG under "image" and optional capturedAt/width/height fields.
 */
export async function POST(req: Request) {
  const token = bearer(req);
  if (!token) return errorJson("Missing agent token", 401);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return errorJson("Expected multipart/form-data", 400);
  }

  const file = form.get("image");
  if (!(file instanceof Blob)) return errorJson("image is required", 400);
  const image = Buffer.from(await file.arrayBuffer());

  const result = await ingestScreenshot({
    token,
    image,
    capturedAt: form.get("capturedAt"),
    width: form.get("width"),
    height: form.get("height"),
  });

  if (result.status === "unauthorized") return errorJson("Unauthorized or paused device", 401);
  if (result.status === "empty_image") return errorJson("Empty image", 400);
  if (result.status === "too_large") return errorJson("Image too large", 413);

  return successJson({ id: result.screenshot.id }, 201);
}

function bearer(req: Request): string | null {
  const header = req.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}
