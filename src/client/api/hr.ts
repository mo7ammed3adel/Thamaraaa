import { buildQueryString, deleteJson, getJson, patchJson, postJson } from "@/client/transport/http";

export function listEmployees() {
  return getJson("/api/hr/employees");
}

export function submitAttendance(body: unknown) {
  return postJson("/api/attendance", body);
}

export function updateAttendance(body: unknown) {
  return patchJson("/api/attendance", body);
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

export function listPromotionEvaluations() {
  return getJson("/api/hr/promotion-engine");
}

export function runPromotionAction(body: unknown) {
  return postJson("/api/hr/promotion-engine", body);
}

export function runAutoEvaluations() {
  return postJson("/api/hr/evaluations");
}

export function listApplicants() {
  return getJson("/api/hr/applicants");
}

export function createApplicant(body: unknown) {
  return postJson("/api/hr/applicants", body);
}

export function updateApplicant(id: string, body: unknown) {
  return patchJson(`/api/hr/applicants/${id}`, body);
}

export function listHrRequests() {
  return getJson<any[]>("/api/hr/requests");
}

export function updateHrRequest(id: string, body: unknown) {
  return patchJson(`/api/hr/requests/${id}`, body);
}
