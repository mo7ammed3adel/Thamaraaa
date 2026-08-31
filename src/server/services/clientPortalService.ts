import bcrypt from "bcryptjs";
import {
  buildClientJourneyView,
  isLoginLocked,
  minutesUntilUnlock,
  registerFailedLogin,
  type ClientJourneyView,
} from "@/lib/clientPortal";
import {
  findClientAccountById,
  findClientAccountCredentialsById,
  findClientAccountByUsername,
  findClientProjectsForLead,
  touchClientAccountLogin,
  updateClientAccountPassword,
  updateClientLoginAttempts,
} from "@/server/repositories/clientAccountRepository";
import { buildClientSession, type ClientSession } from "@/server/auth/clientSession";

const MIN_PASSWORD_LENGTH = 8;

/**
 * Authenticates a client portal login.
 *
 * A wrong username, a wrong password and a suspended account all collapse into
 * one "invalid" result so the response cannot be used to discover which
 * usernames exist. Repeated wrong passwords lock the account for a while —
 * counted on the account rather than the IP, because on serverless every
 * request can land on a fresh instance with its own memory.
 */
export async function loginClient(input: { username: unknown; password: unknown }, now = new Date()) {
  const username = typeof input.username === "string" ? input.username.trim() : "";
  const password = typeof input.password === "string" ? input.password : "";

  if (!username || !password) return { status: "invalid" as const };

  const account = await findClientAccountByUsername(username);
  if (!account || account.status !== "Active") return { status: "invalid" as const };

  if (isLoginLocked(account, now)) {
    return { status: "locked" as const, minutesRemaining: minutesUntilUnlock(account, now) };
  }

  const passwordMatches = await bcrypt.compare(password, account.passwordHash);
  if (!passwordMatches) {
    const next = registerFailedLogin(account, now);
    await updateClientLoginAttempts({
      id: account.id,
      failedLoginAttempts: next.failedLoginAttempts,
      lockedUntil: next.lockedUntil as Date | null,
    });

    if (next.lockedUntil) {
      return { status: "locked" as const, minutesRemaining: minutesUntilUnlock(next, now) };
    }
    return { status: "invalid" as const };
  }

  await touchClientAccountLogin(account.id);

  return {
    status: "ok" as const,
    session: buildClientSession(account.id, account.leadId),
    mustChangePassword: account.mustChangePassword,
  };
}

/**
 * Lets a signed-in client set their own password. Used both for the forced
 * first-login change and for a voluntary change later on.
 */
export async function changeClientPassword(input: {
  session: ClientSession;
  currentPassword: unknown;
  newPassword: unknown;
}) {
  const newPassword = typeof input.newPassword === "string" ? input.newPassword : "";
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return { status: "weak_password" as const, minLength: MIN_PASSWORD_LENGTH };
  }

  const account = await findClientAccountCredentialsById(input.session.accountId);
  if (!account) return { status: "not_found" as const };
  if (account.status !== "Active") return { status: "suspended" as const };

  const currentPassword = typeof input.currentPassword === "string" ? input.currentPassword : "";
  const currentMatches = await bcrypt.compare(currentPassword, account.passwordHash);
  if (!currentMatches) return { status: "wrong_current_password" as const };

  await updateClientAccountPassword({
    id: account.id,
    passwordHash: await bcrypt.hash(newPassword, 10),
    mustChangePassword: false,
  });

  return { status: "ok" as const };
}

export type ClientPortalData = {
  clientName: string;
  mustChangePassword: boolean;
  projects: ClientJourneyView[];
};

/**
 * Everything the signed-in client may see, scoped to their own Lead. The scope
 * comes from the signed session — never from a URL parameter — so one client can
 * never read another client's project by guessing an id.
 */
export async function getClientPortalData(session: ClientSession) {
  const account = await findClientAccountById(session.accountId);
  if (!account) return { status: "not_found" as const };
  if (account.status !== "Active") return { status: "suspended" as const };
  // The session's leadId must still match the account's; a reassigned account
  // invalidates any session minted for the previous customer.
  if (account.leadId !== session.leadId) return { status: "not_found" as const };

  const projects = await findClientProjectsForLead(account.leadId);

  return {
    status: "ok" as const,
    data: {
      clientName: account.lead?.name || "",
      mustChangePassword: account.mustChangePassword,
      projects: projects.map((project) => buildClientJourneyView(project)),
    } satisfies ClientPortalData,
  };
}
