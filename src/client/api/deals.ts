import { postJson } from "@/client/transport/http";

export function createDeal(body: unknown) {
  return postJson("/api/deals", body);
}
