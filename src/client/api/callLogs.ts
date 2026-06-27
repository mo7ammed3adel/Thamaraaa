import { postJson } from "@/client/transport/http";

export function createCallLog(body: unknown) {
  return postJson("/api/call-logs", body);
}
