import { buildQueryString, getJson, postJson } from "@/client/transport/http";

export type ProjectNote = {
  id: string;
  projectId: string;
  userId: string;
  userRole: string;
  userName: string;
  content: string;
  category: string;
  createdAt: string;
};

export function listNotes(params: { projectId: string; category?: string }) {
  return getJson<{ notes?: ProjectNote[] }>(`/api/notes${buildQueryString(params)}`);
}

export function createNote(body: { projectId: string; content: string; category: string }) {
  return postJson<{ note: ProjectNote }>("/api/notes", body);
}
