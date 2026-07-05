import { deleteJson, patchJson, postFormData, postJson } from "@/client/transport/http";

export function createLead(body: unknown) {
  return postJson("/api/leads", body);
}

export function updateLead(id: string, body: unknown) {
  return patchJson(`/api/leads/${id}`, body);
}

export function deleteLead(id: string) {
  return deleteJson(`/api/leads/${id}`);
}

export function distributeLeadMeeting(id: string) {
  return postJson(`/api/leads/${id}/distribute-meeting`);
}

export function bulkPromoteLeads(body: unknown) {
  return postJson("/api/leads/bulk/promote", body);
}

export function bulkDeleteLeads(body: unknown) {
  return postJson("/api/leads/bulk/delete", body);
}

export function importLeads(formData: FormData) {
  return postFormData("/api/leads/import", formData);
}
