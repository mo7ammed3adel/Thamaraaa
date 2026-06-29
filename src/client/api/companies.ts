import { deleteJson, getJson, patchJson, postJson } from "@/client/transport/http";

export function listCompanies() {
  return getJson("/api/companies");
}

export function createCompany(body: unknown) {
  return postJson("/api/companies", body);
}

export function updateCompany(id: string, body: unknown) {
  return patchJson(`/api/companies/${id}`, body);
}

export function deleteCompany(id: string) {
  return deleteJson(`/api/companies/${id}`);
}
