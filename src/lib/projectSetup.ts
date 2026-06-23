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
    lifecycleState: "Onboarding",
  };
}

/** Standard ProjectLog detail string for the initial "setup" entry. */
export function projectSetupLogDetails(packageName: string): string {
  return `Project created from deal. Package: ${packageName}. Awaiting Head AM distribution.`;
}

/**
 * Notifies every active Head Account Manager that a new project is awaiting
 * distribution. Runs outside any transaction (it triggers Pusher / external IO).
 * Failures here never roll back the project — the notification is best-effort.
 */
export async function notifyHeadAccountManagersOfNewProject(
  clientName: string,
  packageName: string
): Promise<void> {
  const headAccountManagers = await prisma.user.findMany({
    where: { role: "head_account_manager", status: "Active" },
    select: { id: true },
  });

  await notifyUsers(
    headAccountManagers.map((ham) => ham.id),
    {
      title: "New Project Awaiting Distribution",
      message: `A new project for "${clientName}" (${packageName}) is ready for assignment.`,
      type: "deal_closed",
      link: "/dashboard/head-account-manager",
    }
  );
}
