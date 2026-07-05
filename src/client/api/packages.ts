import { getJson, postJson } from "@/client/transport/http";

export function listPackages() {
  return getJson<unknown[]>("/api/packages");
}

export function createPackage(body: { name: string; servicesJson: string }) {
  return postJson("/api/packages", body);
}
