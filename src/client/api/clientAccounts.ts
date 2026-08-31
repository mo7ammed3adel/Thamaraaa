import { getJson, patchJson, postJson } from "@/client/transport/http";

export type ClientAccountSummary = {
  id: string;
  username: string;
  status: string;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
} | null;

export function getClientAccount(leadId: string) {
  return getJson<{ account: ClientAccountSummary }>(
    `/api/client-accounts?leadId=${encodeURIComponent(leadId)}`
  );
}

export function createClientAccount(leadId: string) {
  return postJson<{ account: { id: string; username: string }; temporaryPassword: string }>(
    "/api/client-accounts",
    { leadId }
  );
}

export function resetClientAccountPassword(accountId: string) {
  return postJson<{ username: string; temporaryPassword: string }>(
    `/api/client-accounts/${accountId}/reset-password`
  );
}

export function setClientAccountStatus(accountId: string, status: "Active" | "Suspended") {
  return patchJson<{ account: { id: string; status: string } }>(
    `/api/client-accounts/${accountId}/status`,
    { status }
  );
}
