import { getJson, patchJson, postJson } from "@/client/transport/http";

export type NotificationItem = {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  read?: boolean;
  link?: string | null;
};

export function listUnreadNotifications() {
  return getJson<{ data?: NotificationItem[] }>("/api/notifications");
}

export function listMeetingLinkNotifications() {
  return getJson<{ data?: NotificationItem[] }>("/api/notifications?type=meeting_links");
}

export function markNotificationRead(id: string) {
  return patchJson(`/api/notifications/${id}`);
}

export function sendNotification(body: unknown) {
  return postJson("/api/notifications/send", body);
}

/** Full history (read + unread), not just the unread ones the bell shows. */
export function listNotificationHistory() {
  return getJson<{ data?: NotificationItem[] }>("/api/notifications?type=history");
}
