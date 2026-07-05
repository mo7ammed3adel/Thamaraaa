import { deleteJson, getJson, patchJson, postJson } from "@/client/transport/http";

export function listUsers() {
  return getJson("/api/users");
}

export function updateUser(id: string, body: unknown) {
  return patchJson(`/api/users/${id}`, body);
}

export function updateUserStatus(id: string, body: unknown) {
  return patchJson(`/api/users/${id}/status`, body);
}

export function updateUserSpecialization(id: string, body: unknown) {
  return patchJson(`/api/users/${id}/specialization`, body);
}

export function updateUserTarget(id: string, body: unknown) {
  return patchJson(`/api/users/${id}/target`, body);
}

export function createUser(body: unknown) {
  return postJson("/api/users", body);
}

export function deleteUser(id: string) {
  return deleteJson(`/api/users/${id}`);
}
