import { prisma } from "./prisma";
import { notifyUsers } from "./notify";

/**
 * Shared helpers for creating a Project from a closed Deal.
 *
 * The deal-close flow MUST guarantee a project (spec §7, §22): a closed deal
 * without a project orphans the client out of Operations with no recovery path.
 * These helpers are used by:
 *   - POST /api/deals          → creates the project in the SAME transaction as
 *                                 the deal, so the two can never diverge.
 *   - POST /api/projects/setup → manual recovery for any legacy deal that has no
 *                                 project yet (idempotent — guarded by a unique
 *                                 project-per-deal check in the route).
 */

interface ProjectSeedDeal {
  id: string;
  package: string;
}

/** Builds the create payload for a brand-new, unassigned project from a deal. */
export function buildNewProjectData(
  deal: ProjectSeedDeal,
  niche?: string | null,
  deadline?: Date | null
) {
  return {
    dealId: deal.id,
    accountManagerId: null,
    headTechnicalId: null,
    niche: niche ?? null,
    package: deal.package,
    technicalDeadline: deadline ?? null,
    finalDeadline: deadline ?? null,
    projectStatus: "new",
    lifecycleState: "Active",
  };
}

/** Standard ProjectLog detail string for the initial "setup" entry. */
export function projectSetupLogDetails(packageName: string): string {
  return `Project created from deal. Package: ${packageName}. Awaiting Head AM distribution.`;
}

/**
 * Notifies the Super Admin(s) that a new project is awaiting manual assignment
 * to a Head Account Manager. A new client must NOT auto-drop onto every Head
 * Account Manager — the super_admin distributes it to one of them. Runs outside
 * any transaction; failures never roll back the project (best-effort).
 */
export async function notifyHeadAccountManagersOfNewProject(
  clientName: string,
  packageName: string
): Promise<void> {
  const superAdmins = await prisma.user.findMany({
    where: { role: "super_admin", status: "Active" },
    select: { id: true },
  });

  await notifyUsers(
    superAdmins.map((admin) => admin.id),
    {
      title: "New Client Awaiting Assignment",
      message: `A new project for "${clientName}" (${packageName}) is ready — assign it to a Head Account Manager.`,
      type: "deal_closed",
      link: "/dashboard/head-account-manager",
    }
  );
}
