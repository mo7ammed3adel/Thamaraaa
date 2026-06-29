import { deleteJson, getJson, patchJson, postJson } from "@/client/transport/http";

export function listDepartments() {
  return getJson("/api/hr/departments");
}

export function createDepartment(body: unknown) {
  return postJson("/api/hr/departments", body);
}

export function updateDepartment(id: string, body: unknown) {
  return patchJson(`/api/hr/departments/${id}`, body);
}

export function deleteDepartment(id: string) {
  return deleteJson(`/api/hr/departments/${id}`);
}

export function addDepartmentDocument(id: string, body: unknown) {
  return postJson(`/api/hr/departments/${id}/documents`, body);
}

export function deleteDepartmentDocument(id: string, docId: string) {
  return deleteJson(`/api/hr/departments/${id}/documents?docId=${encodeURIComponent(docId)}`);
}
