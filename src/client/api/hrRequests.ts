import { getJson, patchJson, postJson } from "@/client/transport/http";

// Salary advances
export function listSalaryAdvances() {
  return getJson("/api/hr/salary-advance");
}
export function submitSalaryAdvance(body: unknown) {
  return postJson("/api/hr/salary-advance", body);
}
export function actOnSalaryAdvance(id: string, body: unknown) {
  return patchJson(`/api/hr/salary-advance/${id}`, body);
}

// Complaints
export function listComplaints() {
  return getJson("/api/hr/complaints");
}
export function submitComplaint(body: unknown) {
  return postJson("/api/hr/complaints", body);
}
export function updateComplaint(id: string, body: unknown) {
  return patchJson(`/api/hr/complaints/${id}`, body);
}
