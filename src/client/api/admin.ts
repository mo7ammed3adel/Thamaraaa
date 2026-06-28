import { deleteJson, postJson } from "@/client/transport/http";

export function impersonateUser(userId: string) {
  return postJson("/api/admin/impersonate", { userId });
}

export function stopImpersonation() {
  return deleteJson("/api/admin/impersonate");
}
