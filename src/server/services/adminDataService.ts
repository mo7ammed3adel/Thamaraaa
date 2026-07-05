import { prisma } from "@/lib/prisma";

// Operational CRM entities cleared by the test-data reset, ordered children-first
// so foreign-key constraints never block a delete. Users, Companies, Packages, all
// HR tables, and system/commission config are intentionally NOT in this list and
// are left completely untouched. Mirrors scratch/wipe_keep_users_companies_packages_hr.cjs.
const WIPE_ORDER = [
  "warningReceipt",
  "warning",
  "teamAssignment",
  "note",
  "projectLog",
  "projectFile",
  "task",
  "customColumnValue",
  "customColumn",
  "installment",
  "project",
  "meeting",
  "deal",
  "callLog",
  "agentTarget",
  "notification",
  "lead",
] as const;

export type WipeTestDataResult = {
  status: "ok";
  deleted: Record<string, number>;
  total: number;
};

/**
 * Wipes all operational CRM data (leads/clients, meetings, calls, deals, projects,
 * tasks, notifications, and their dependents) while preserving users, companies,
 * packages, HR, and configuration. Runs as a single all-or-nothing transaction so a
 * failure can never leave the database half-wiped.
 *
 * Intended for super-admin use to reset the environment for testing.
 */
export async function wipeTestData(): Promise<WipeTestDataResult> {
  // Prisma model accessors are keyed by camelCase model name; index dynamically so
  // the wipe list stays a single source of truth. `any` preserves the PrismaPromise
  // return type that $transaction requires for its batch (array) form.
  const client = prisma as any;

  const ops = WIPE_ORDER.map((model) => client[model].deleteMany());
  const results = await prisma.$transaction(ops);

  const deleted: Record<string, number> = {};
  let total = 0;
  WIPE_ORDER.forEach((model, i) => {
    deleted[model] = results[i].count;
    total += results[i].count;
  });

  return { status: "ok", deleted, total };
}
