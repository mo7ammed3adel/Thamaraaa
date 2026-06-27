import { getJson, postJson } from "@/client/transport/http";

export function listNiches() {
  return getJson("/api/niches");
}

export function createNiche(body: unknown) {
  return postJson("/api/niches", body);
}
