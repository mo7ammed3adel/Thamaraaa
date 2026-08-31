import crypto from "crypto";
import bcrypt from "bcryptjs";
import { buildClientUsername } from "@/lib/clientPortal";
import {
  countClientAccountsWithUsernamePrefix,
  createClientAccountRecord,
  findClientAccountByLeadId,
  findClientAccountById,
  findLeadForClientAccount,
  findLeadProjectAccountManagerIds,
  updateClientAccountPassword,
  updateClientAccountStatus,
} from "@/server/repositories/clientAccountRepository";

/** Roles allowed to hand a customer their portal credentials. */
const CLIENT_ACCOUNT_MANAGER_ROLES = ["super_admin", "head_account_manager", "account_manager"];

// Ambiguous characters are omitted: a client reads this password off WhatsApp.
const PASSWORD_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const TEMPORARY_PASSWORD_LENGTH = 10;

function generateTemporaryPassword(): string {
  const bytes = crypto.randomBytes(TEMPORARY_PASSWORD_LENGTH);
  let password = "";
  for (let index = 0; index < TEMPORARY_PASSWORD_LENGTH; index += 1) {
    password += PASSWORD_ALPHABET[bytes[index] % PASSWORD_ALPHABET.length];
  }
  return password;
}

/**
 * An Account Manager may only issue credentials for a customer they actually
 * manage; the Head AM and super admin may do it for anyone.
 */
async function canManageClientAccount(
  actor: { id: string; role: string },
  leadId: string
): Promise<boolean> {
  if (!CLIENT_ACCOUNT_MANAGER_ROLES.includes(actor.role)) return false;
  if (actor.role === "super_admin" || actor.role === "head_account_manager") return true;

  const accountManagerIds = await findLeadProjectAccountManagerIds(leadId);
  return accountManagerIds.includes(actor.id);
}

/** Picks a free username, suffixing on collision (two leads can share a phone). */
async function resolveUsername(phone: string | null, leadId: string): Promise<string> {
  const base = buildClientUsername(phone) || `client-${leadId.slice(0, 8)}`;
  const taken = await countClientAccountsWithUsernamePrefix(base);
  return taken === 0 ? base : `${base}-${taken + 1}`;
}

/**
 * Creates the customer's portal login and returns the one-time password.
 *
 * The plain password is returned exactly once, here, so the Account Manager can
 * pass it to the client; only its hash is stored. The client is forced to
 * replace it on first login.
 */
export async function createClientAccount(input: {
  actor: { id: string; role: string };
  leadId: unknown;
}) {
  const leadId = typeof input.leadId === "string" ? input.leadId.trim() : "";
  if (!leadId) return { status: "missing_lead" as const };

  if (!(await canManageClientAccount(input.actor, leadId))) {
    return { status: "forbidden" as const };
  }

  const lead = await findLeadForClientAccount(leadId);
  if (!lead) return { status: "lead_not_found" as const };

  const existing = await findClientAccountByLeadId(leadId);
  if (existing) return { status: "already_exists" as const, account: existing };

  const temporaryPassword = generateTemporaryPassword();
  const account = await createClientAccountRecord({
    username: await resolveUsername(lead.phone, leadId),
    passwordHash: await bcrypt.hash(temporaryPassword, 10),
    leadId,
    createdByUserId: input.actor.id,
  });

  return {
    status: "ok" as const,
    account: { id: account.id, username: account.username, status: account.status },
    temporaryPassword,
  };
}

/** Issues a fresh one-time password, e.g. when the client forgets theirs. */
export async function resetClientAccountPassword(input: {
  actor: { id: string; role: string };
  accountId: string;
}) {
  const account = await findClientAccountById(input.accountId);
  if (!account) return { status: "not_found" as const };

  if (!(await canManageClientAccount(input.actor, account.leadId))) {
    return { status: "forbidden" as const };
  }

  const temporaryPassword = generateTemporaryPassword();
  await updateClientAccountPassword({
    id: account.id,
    passwordHash: await bcrypt.hash(temporaryPassword, 10),
    mustChangePassword: true,
  });

  return { status: "ok" as const, username: account.username, temporaryPassword };
}

/**
 * Suspends or re-activates portal access. A suspended account is rejected at
 * login and its existing sessions stop resolving on the very next request.
 */
export async function setClientAccountStatus(input: {
  actor: { id: string; role: string };
  accountId: string;
  status: unknown;
}) {
  const status = input.status === "Active" || input.status === "Suspended" ? input.status : null;
  if (!status) return { status: "invalid_status" as const };

  const account = await findClientAccountById(input.accountId);
  if (!account) return { status: "not_found" as const };

  if (!(await canManageClientAccount(input.actor, account.leadId))) {
    return { status: "forbidden" as const };
  }

  const updated = await updateClientAccountStatus(account.id, status);
  return { status: "ok" as const, account: updated };
}

/** The portal account attached to a customer, for the Account Manager's view. */
export async function getClientAccountForLead(input: {
  actor: { id: string; role: string };
  leadId: string;
}) {
  if (!(await canManageClientAccount(input.actor, input.leadId))) {
    return { status: "forbidden" as const };
  }

  const account = await findClientAccountByLeadId(input.leadId);
  return { status: "ok" as const, account };
}
