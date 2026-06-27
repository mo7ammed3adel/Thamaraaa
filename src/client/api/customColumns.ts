import { deleteJson, postJson, putJson } from "@/client/transport/http";

export function createCustomColumn(body: unknown) {
  return postJson("/api/custom-columns", body);
}

export function deleteCustomColumn(id: string) {
  return deleteJson(`/api/custom-columns?id=${encodeURIComponent(id)}`);
}

export function saveCustomColumnValue(body: unknown) {
  return putJson("/api/custom-columns/values", body);
}
