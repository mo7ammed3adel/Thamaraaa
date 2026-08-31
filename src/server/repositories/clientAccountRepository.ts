import { prisma } from "@/lib/prisma";

/** Account lookup for the login form — username is the client's identifier. */
export function findClientAccountByUsername(username: string) {
  return prisma.clientAccount.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      passwordHash: true,
      leadId: true,
      status: true,
      mustChangePassword: true,
      failedLoginAttempts: true,
      lockedUntil: true,
    },
  });
}

export function findClientAccountById(id: string) {
  return prisma.clientAccount.findUnique({
    where: { id },
    select: {
      id: true,
      username: true,
      leadId: true,
      status: true,
      mustChangePassword: true,
      lead: { select: { name: true } },
    },
  });
}

/** Credentials-only lookup, for verifying a client's current password. */
export function findClientAccountCredentialsById(id: string) {
  return prisma.clientAccount.findUnique({
    where: { id },
    select: { id: true, passwordHash: true, status: true },
  });
}

export function findClientAccountByLeadId(leadId: string) {
  return prisma.clientAccount.findUnique({
    where: { leadId },
    select: {
      id: true,
      username: true,
      status: true,
      mustChangePassword: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });
}

export function findClientAccountsByLeadIds(leadIds: string[]) {
  return prisma.clientAccount.findMany({
    where: { leadId: { in: leadIds } },
    select: {
      id: true,
      leadId: true,
      username: true,
      status: true,
      mustChangePassword: true,
      lastLoginAt: true,
    },
  });
}

export function countClientAccountsWithUsernamePrefix(prefix: string) {
  return prisma.clientAccount.count({ where: { username: { startsWith: prefix } } });
}

export function createClientAccountRecord(input: {
  username: string;
  passwordHash: string;
  leadId: string;
  createdByUserId: string;
}) {
  return prisma.clientAccount.create({
    data: {
      username: input.username,
      passwordHash: input.passwordHash,
      leadId: input.leadId,
      createdByUserId: input.createdByUserId,
      mustChangePassword: true,
    },
    select: { id: true, username: true, leadId: true, status: true },
  });
}

export function updateClientAccountPassword(input: {
  id: string;
  passwordHash: string;
  mustChangePassword: boolean;
}) {
  return prisma.clientAccount.update({
    where: { id: input.id },
    data: {
      passwordHash: input.passwordHash,
      mustChangePassword: input.mustChangePassword,
    },
    select: { id: true, username: true },
  });
}

export function updateClientAccountStatus(id: string, status: string) {
  return prisma.clientAccount.update({
    where: { id },
    data: { status },
    select: { id: true, username: true, status: true },
  });
}

/** Records a successful sign-in and clears any brute-force counters. */
export function touchClientAccountLogin(id: string) {
  return prisma.clientAccount.update({
    where: { id },
    data: { lastLoginAt: new Date(), failedLoginAttempts: 0, lockedUntil: null },
    select: { id: true },
  });
}

/** Persists the counter state produced after a wrong password. */
export function updateClientLoginAttempts(input: {
  id: string;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
}) {
  return prisma.clientAccount.update({
    where: { id: input.id },
    data: {
      failedLoginAttempts: input.failedLoginAttempts,
      lockedUntil: input.lockedUntil,
    },
    select: { id: true },
  });
}

/** The customer record a portal account belongs to, used to build usernames. */
export function findLeadForClientAccount(leadId: string) {
  return prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, name: true, phone: true },
  });
}

/**
 * Account Manager ids across all of a customer's projects — the scope check for
 * an AM issuing or resetting that customer's portal credentials.
 */
export async function findLeadProjectAccountManagerIds(leadId: string): Promise<string[]> {
  const projects = await prisma.project.findMany({
    where: { deal: { is: { leadId } } },
    select: { accountManagerId: true },
  });

  return projects
    .map((project) => project.accountManagerId)
    .filter((id): id is string => Boolean(id));
}

/**
 * Every project belonging to one customer, with exactly the relations the client
 * portal projection consumes — no notes, warnings, logs, team assignments or
 * employee relations are loaded at all, so internal data never reaches the view.
 */
export function findClientProjectsForLead(leadId: string) {
  return prisma.project.findMany({
    where: { deal: { is: { leadId } } },
    select: {
      id: true,
      package: true,
      projectStatus: true,
      assignedAt: true,
      storeUrl: true,
      seoProgress: true,
      socialMediaProgress: true,
      mediaBuyerProgress: true,
      createdAt: true,
      tasks: {
        select: {
          id: true,
          taskType: true,
          status: true,
          deadline: true,
          completedAt: true,
          files: true,
        },
        orderBy: { createdAt: "asc" },
      },
      deal: {
        select: {
          totalAmount: true,
          firstAmount: true,
          contractStart: true,
          contractEnd: true,
          createdAt: true,
          installments: {
            select: { amount: true, dueDate: true, isPaid: true },
            orderBy: { dueDate: "asc" },
          },
          lead: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}
