import { beforeAll, describe, expect, it } from "vitest";
import {
  buildClientSession,
  decodeClientSession,
  encodeClientSession,
} from "@/server/auth/clientSession";

beforeAll(() => {
  process.env.NEXTAUTH_SECRET = "test-secret-for-client-portal-sessions";
});

describe("client portal session tokens", () => {
  it("round-trips a signed session", () => {
    const session = buildClientSession("account-1", "lead-1");

    expect(decodeClientSession(encodeClientSession(session))).toEqual(session);
  });

  it("rejects a token whose payload was tampered with", () => {
    const token = encodeClientSession(buildClientSession("account-1", "lead-1"));
    const forgedPayload = Buffer.from(
      JSON.stringify({ accountId: "account-2", leadId: "lead-2", exp: 9999999999 }),
      "utf8"
    ).toString("base64url");

    expect(decodeClientSession(`${forgedPayload}.${token.split(".")[1]}`)).toBeNull();
  });

  it("rejects an expired session", () => {
    const expired = { accountId: "account-1", leadId: "lead-1", exp: 1000 };

    expect(decodeClientSession(encodeClientSession(expired))).toBeNull();
  });

  it("rejects malformed and empty tokens", () => {
    expect(decodeClientSession("")).toBeNull();
    expect(decodeClientSession(undefined)).toBeNull();
    expect(decodeClientSession("no-separator")).toBeNull();
    expect(decodeClientSession("abc.def")).toBeNull();
  });
});
