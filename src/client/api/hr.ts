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

export function submitLeaveRequest(body: unknown) {
  return postJson("/api/hr/requests", body);
}

export function getPayslip(params: Record<string, string | number | boolean | null | undefined> = {}) {
  return getJson(`/api/hr/payslip${buildQueryString(params)}`);
}

export function listPayroll(params: Record<string, string | number | boolean | null | undefined> = {}) {
  return getJson(`/api/hr/payroll${buildQueryString(params)}`);
}

export function listReviews(params: Record<string, string | number | boolean | null | undefined> = {}) {
  return getJson(`/api/hr/reviews${buildQueryString(params)}`);
}

export function createReview(body: unknown) {
  return postJson("/api/hr/reviews", body);
}

export function listOnboarding(params: Record<string, string | number | boolean | null | undefined> = {}) {
  return getJson(`/api/hr/onboarding${buildQueryString(params)}`);
}

export function manageOnboarding(body: unknown) {
  return postJson("/api/hr/onboarding", body);
}

export function toggleOnboarding(body: unknown) {
  return patchJson("/api/hr/onboarding", body);
}

export function deleteOnboardingTask(id: string) {
  return deleteJson(`/api/hr/onboarding?id=${encodeURIComponent(id)}`);
}

export function listHrRequests() {
  return getJson<any[]>("/api/hr/requests");
}

export function updateHrRequest(id: string, body: unknown) {
  return patchJson(`/api/hr/requests/${id}`, body);
}

export function getViralHrm(params: Record<string, string | number | boolean | null | undefined> = {}) {
  return getJson(`/api/hr/viral${buildQueryString(params)}`);
}

export function createViralHrmResource(body: unknown) {
  return postJson("/api/hr/viral", body);
}

export function updateViralHrmResource(body: unknown) {
  return patchJson("/api/hr/viral", body);
}

export function deleteViralHrmResource(resource: string, id: string) {
  return deleteJson(`/api/hr/viral?resource=${encodeURIComponent(resource)}&id=${encodeURIComponent(id)}`);
}
