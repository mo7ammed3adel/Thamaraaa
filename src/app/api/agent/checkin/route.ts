import { errorJson, successJson } from "@/server/http/responses";
import { agentCheckIn } from "@/server/services/deviceMonitoringService";

/**
 * POST /api/agent/checkin
 * The desktop agent's heartbeat. Authenticated by its enrolment token in the
 * Authorization header, never by a NextAuth session — the agent is not a user.
 * Returns the capture interval and whether it should currently be capturing.
 */
export async function POST(req: Request) {
  const token = bearer(req);
  if (!token) return errorJson("Missing agent token", 401);

  const result = await agentCheckIn(token);
  if (result.status === "unauthorized") return errorJson("Unauthorized device", 401);

  return successJson({
    capturing: result.capturing,
    intervalMinutes: result.intervalMinutes,
  });
}

function bearer(req: Request): string | null {
  const header = req.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}
