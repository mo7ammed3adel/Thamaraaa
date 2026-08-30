import crypto from "crypto";
import { cookies } from "next/headers";

/**
 * Client Portal session.
 *
 * Deliberately separate from the NextAuth employee session: a different cookie,
 * a different payload and a different verifier. A client token can therefore
 * never satisfy getSessionUser(), and an employee token can never satisfy
 * readClientSession() — the two auth systems cannot be confused for each other.
 */

export const CLIENT_SESSION_COOKIE = "client_portal_session";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14; // 14 days

export type ClientSession = {
  accountId: string;
  leadId: string;
  /** Unix seconds. */
  exp: number;
};

function signingSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is required to sign client portal sessions");
  // Namespaced so a client token is not a valid signature in any other context.
  return `client-portal:${secret}`;
}

function sign(data: string): string {
  return crypto.createHmac("sha256", signingSecret()).update(data).digest("base64url");
}

/** Encodes and signs a session as "<payload>.<signature>". */
export function encodeClientSession(session: ClientSession): string {
  const payload = Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/** Verifies a token and returns its session, or null when invalid or expired. */
export function decodeClientSession(token: string | undefined | null): ClientSession | null {
  if (!token) return null;

  const separator = token.lastIndexOf(".");
  if (separator <= 0) return null;

  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  const expected = sign(payload);

  // Constant-time compare; Buffer.from on differing lengths would throw in timingSafeEqual.
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length) return null;
  if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (
      typeof parsed?.accountId !== "string" ||
      typeof parsed?.leadId !== "string" ||
      typeof parsed?.exp !== "number"
    ) {
      return null;
    }
    if (parsed.exp * 1000 < Date.now()) return null;
    return parsed as ClientSession;
  } catch {
    return null;
  }
}

export function buildClientSession(accountId: string, leadId: string, now = new Date()): ClientSession {
  return {
    accountId,
    leadId,
    exp: Math.floor(now.getTime() / 1000) + SESSION_TTL_SECONDS,
  };
}

export function setClientSessionCookie(session: ClientSession): void {
  cookies().set(CLIENT_SESSION_COOKIE, encodeClientSession(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearClientSessionCookie(): void {
  cookies().set(CLIENT_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

/** Reads and verifies the current request's client session, if any. */
export function readClientSession(): ClientSession | null {
  return decodeClientSession(cookies().get(CLIENT_SESSION_COOKIE)?.value);
}
