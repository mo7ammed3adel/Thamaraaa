import { deleteJson, postJson } from "@/client/transport/http";

export function impersonateUser(userId: string) {
  return postJson("/api/admin/impersonate", { userId });
}

export function stopImpersonation() {
  return deleteJson("/api/admin/impersonate");
}

export type WipeTestDataResponse = {
  status: string;
  deleted: Record<string, number>;
  total: number;
};

export function wipeTestData() {
  return postJson<WipeTestDataResponse>("/api/admin/wipe-test-data", { confirm: "WIPE" });
}
