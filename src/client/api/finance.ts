import { buildQueryString, getJson, patchJson, postJson } from "@/client/transport/http";

export function getFinanceOverview() {
  return getJson("/api/finance/overview");
}

export function updateInstallment(id: string, body: unknown) {
  return patchJson(`/api/finance/installments/${id}`, body);
}

export function listCommissions(month: string) {
  return getJson(`/api/finance/commissions${buildQueryString({ month })}`);
}

export function recomputeCommissions(body: unknown) {
  return postJson("/api/finance/commissions", body);
}

export function updateCommission(id: string, body: unknown) {
  return patchJson(`/api/finance/commissions/${id}`, body);
}
