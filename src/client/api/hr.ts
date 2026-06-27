import { buildQueryString, deleteJson, getJson, patchJson, postJson } from "@/client/transport/http";

export function listEmployees() {
  return getJson("/api/hr/employees");
}

export function createEmployee(body: unknown) {
  return postJson("/api/hr/employees", body);
}

export function updateEmployee(body: unknown) {
  return patchJson("/api/hr/employees", body);
}

export function listDocuments(params: Record<string, string | number | boolean | null | undefined> = {}) {
  return getJson(`/api/hr/documents${buildQueryString(params)}`);
}

export function createDocument(body: unknown) {
  return postJson("/api/hr/documents", body);
}

export function deleteDocument(id: string) {
  return deleteJson(`/api/hr/documents?id=${encodeURIComponent(id)}`);
}
