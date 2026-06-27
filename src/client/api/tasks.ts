import { getJson, patchJson, postJson } from "@/client/transport/http";

export function listTasks(projectId?: string) {
  return getJson(`/api/tasks${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ""}`);
}

export function createTask(body: unknown) {
  return postJson("/api/tasks", body);
}

export function updateTask(taskId: string, body: unknown) {
  return patchJson(`/api/tasks/${taskId}`, body);
}

export function generateTasks(body: unknown) {
  return postJson("/api/tasks/generate", body);
}

export function createSelfTask(body: unknown) {
  return postJson("/api/tasks/self", body);
}

export function reassignTask(taskId: string, body: unknown) {
  return postJson(`/api/tasks/${taskId}/reassign`, body);
}

export function flagTask(taskId: string, body: unknown) {
  return postJson(`/api/tasks/${taskId}/flag`, body);
}
