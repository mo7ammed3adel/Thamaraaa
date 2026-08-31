import { postJson } from "@/client/transport/http";

export function loginToPortal(body: { username: string; password: string }) {
  return postJson<{ success: boolean; mustChangePassword: boolean }>("/api/portal/login", body);
}

export function logoutFromPortal() {
  return postJson<{ success: boolean }>("/api/portal/logout");
}

export function changePortalPassword(body: { currentPassword: string; newPassword: string }) {
  return postJson<{ success: boolean }>("/api/portal/change-password", body);
}
