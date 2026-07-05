import { postJson } from "@/client/transport/http";

export function saveSetting(body: { key: string; value: string }) {
  return postJson("/api/settings", body);
}

export function saveCommissionRule(body: { role: string; percentage: string | number }) {
  return postJson("/api/settings/commissions", body);
}
