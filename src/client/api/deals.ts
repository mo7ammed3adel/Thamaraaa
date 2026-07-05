import { getJson, postJson } from "@/client/transport/http";

export function createDeal(body: unknown) {
  return postJson("/api/deals", body);
}

/** Closed deals visible to the current user (the route returns a bare array). */
export function listDeals() {
  return getJson<unknown[]>("/api/deals/list");
}
