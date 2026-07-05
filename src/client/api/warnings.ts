import { getJson, postJson } from "@/client/transport/http";

export type WarningItem = {
  id: string;
  message: string;
  subject?: string;
  severity?: string;
  senderRole: string;
  senderUserId: string;
  createdAt: string;
  userAcknowledged?: boolean;
};

export function listWarnings() {
  return getJson<WarningItem[]>("/api/warnings");
}

export function acknowledgeWarning(id: string) {
  return postJson<{ success?: boolean }>(`/api/warnings/${id}/acknowledge`);
}

export function createWarning(body: unknown) {
  return postJson("/api/warnings", body);
}

export function resolveWarning(id: string) {
  return postJson(`/api/warnings/${id}/resolve`);
}
