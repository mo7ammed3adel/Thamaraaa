import { getJson, patchJson, postJson } from "@/client/transport/http";

export type NotificationItem = {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  link?: string | null;
};

export function listUnreadNotifications() {
  return getJson<{ data?: NotificationItem[] }>("/api/notifications");
}

export function markNotificationRead(id: string) {
  return patchJson(`/api/notifications/${id}`);
}

export function sendNotification(body: unknown) {
  return postJson("/api/notifications/send", body);
}
