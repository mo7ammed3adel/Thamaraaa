import { deleteJson, getJson, patchJson, postJson } from "@/client/transport/http";

export function setupProject(projectId: string, body: unknown) {
  return patchJson(`/api/projects/${projectId}/setup`, body);
}

export function updateProjectStatus(projectId: string, body: unknown) {
  return patchJson(`/api/projects/${projectId}/status`, body);
}

export function updateProjectTeamAssignment(projectId: string, body: unknown) {
  return postJson(`/api/projects/${projectId}/team-assignment`, body);
}

export function assignProjectAgent(projectId: string, body: unknown) {
  return postJson(`/api/projects/${projectId}/assign-agent`, body);
}

export function distributeProject(body: unknown) {
  return postJson("/api/projects/distribute", body);
}

export function reassignAccountManager(projectId: string, body: unknown) {
  return patchJson(`/api/projects/${projectId}/reassign-am`, body);
}

export function assignHeadAccountManager(projectId: string, body: unknown) {
  return patchJson(`/api/projects/${projectId}/head-account-manager`, body);
}

export function listProjectFiles(projectId: string) {
  return getJson(`/api/projects/${projectId}/files`);
}

export function addProjectFile(projectId: string, body: unknown) {
  return postJson(`/api/projects/${projectId}/files`, body);
}

export function deleteProjectFile(projectId: string, fileId: string) {
  return deleteJson(`/api/projects/${projectId}/files?id=${encodeURIComponent(fileId)}`);
}
