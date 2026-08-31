import { deleteJson, getJson, patchJson, postJson, putJson } from "@/client/transport/http";

export type MonitoredDevice = {
  id: string;
  label: string | null;
  hostname: string | null;
  platform: string | null;
  status: string;
  lastSeenAt: string | Date | null;
  createdAt: string | Date;
  user: { id: string; name: string; role: string };
  _count: { screenshots: number };
};

export type ScreenshotRow = {
  id: string;
  capturedAt: string | Date;
  width: number | null;
  height: number | null;
  device: { id: string; label: string | null };
  user: { id: string; name: string; role: string };
};

export function listDevices() {
  return getJson<{ devices: MonitoredDevice[] }>("/api/devices");
}

export function enrolDevice(body: { userId: string; label?: string }) {
  return postJson<{ device: { id: string }; token: string }>("/api/devices", body);
}

export function setDeviceStatus(deviceId: string, status: "Active" | "Paused" | "Revoked") {
  return patchJson<{ device: { id: string; status: string } }>(
    `/api/devices/${deviceId}/status`,
    { status }
  );
}

/** Re-issues the device's token and kills the old one. Returns the new token once. */
export function reissueDeviceToken(deviceId: string) {
  return postJson<{ token: string }>(`/api/devices/${deviceId}/reissue-token`);
}

/** Reassigns the owner and/or renames the device. */
export function updateDevice(deviceId: string, body: { userId?: string; label?: string | null }) {
  return patchJson<{ device: { id: string; userId: string; label: string | null } }>(
    `/api/devices/${deviceId}`,
    body
  );
}

/** Permanently removes the device and all its screenshots. */
export function deleteDevice(deviceId: string) {
  return deleteJson<{ deletedScreenshots: number }>(`/api/devices/${deviceId}`);
}

export function getInterval() {
  return getJson<{ minutes: number }>("/api/devices/interval");
}

export function setInterval(minutes: number) {
  return putJson<{ minutes: number }>("/api/devices/interval", { minutes });
}

export function getRetention() {
  return getJson<{ days: number }>("/api/devices/retention");
}

export function setRetention(days: number) {
  return putJson<{ days: number }>("/api/devices/retention", { days });
}

export function listScreenshots(params: Record<string, string | number | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") q.set(k, String(v));
  }
  return getJson<{
    screenshots: ScreenshotRow[];
    pagination: { page: number; pageSize: number; total: number; pages: number };
  }>(`/api/devices/screenshots?${q.toString()}`);
}

/** Permanently deletes the chosen screenshots -- image and record both. */
export function deleteScreenshots(ids: string[]) {
  return deleteJson<{ deleted: number; failed: number }>("/api/devices/screenshots", {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
}
