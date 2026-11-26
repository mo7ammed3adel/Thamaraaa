import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { userCanAccessProject } from "@/lib/distribution";
import { buildClientJourneyTimeline } from "@/lib/clientJourneyTimeline";
import { findMembership, memberIdsOf, notifyMembers, postSystemMessage, type ChatActor } from "./chatService";
import { allowAction } from "./rateLimit";

/**
 * A group's client: the project it was made for (client groups) or the one
 * an owner/admin linked it to. Members see that client's journey — the same
 * timeline as the client page — right inside the chat.
 */

export function journeyProjectIdOf(c: { projectId: string | null; linkedProjectId: string | null }): string | null {
  return c.projectId ?? c.linkedProjectId ?? null;
}

const JOURNEY_INCLUDE = {
  accountManager: { select: { id: true, name: true, role: true } },
  deal: {
    include: {
      lead: {
        include: {
          callLogs: { include: { agent: { select: { id: true, name: true, role: true } } }, orderBy: { createdAt: "asc" as const } },
          meetings: {
            include: { teleAgent: { select: { id: true, name: true, role: true } }, salesAgent: { select: { id: true, name: true, role: true } } },
            orderBy: { createdAt: "asc" as const },
          },
        },
      },
      salesAgent: { select: { id: true, name: true, role: true } },
      installments: { orderBy: { dueDate: "asc" as const } },
    },
  },
  tasks: {
    include: {
      leader: { select: { id: true, name: true, role: true } },
      agent: { select: { id: true, name: true, role: true } },
      subTasks: { include: { leader: { select: { id: true, name: true, role: true } }, agent: { select: { id: true, name: true, role: true } } } },
    },
    orderBy: { createdAt: "asc" as const },
  },
  globalNotes: { orderBy: { createdAt: "desc" as const } },
  warnings: {
    where: { status: { not: "Resolved" } },
    include: { sender: { select: { id: true, name: true, role: true } } },
    orderBy: { createdAt: "desc" as const },
  },
};

/** The journey for a conversation's members (membership is the access check). */
export async function getConversationJourney(actor: ChatActor, conversationId: string) {
  const membership = await findMembership(conversationId, actor.id);
  if (!membership) return { status: "not_found" as const };
  const projectId = journeyProjectIdOf(membership.conversation);
  if (!projectId) return { status: "ok" as const, journey: null };
  if (!allowAction(`journey:${actor.id}`, 30, 60_000)) return { status: "rate_limited" as const };

  const project = await prisma.project.findUnique({ where: { id: projectId }, include: JOURNEY_INCLUDE });
  if (!project) return { status: "ok" as const, journey: null };

  // The shared timeline builder; only its rows are sent, not the raw records.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const timeline = buildClientJourneyTimeline(project as any).map((e) => ({ ...e, date: new Date(e.date).toISOString() }));
  const lead = project.deal?.lead;
  // Group members who may not open the client themselves see the outline
  // (what happened, when, by whom) but not money, notes or call details.
  const fullAccess = await userCanAccessProject(actor.id, actor.role, project.id);
  const rows = fullAccess ? timeline : timeline.map((e) => ({ ...e, detail: "" }));
  return {
    status: "ok" as const,
    journey: {
      projectId: project.id,
      clientName: lead?.name ?? "—",
      package: project.package,
      projectStatus: project.projectStatus,
      lifecycleState: project.lifecycleState,
      accountManager: project.accountManager?.name ?? null,
      createdAt: project.createdAt.toISOString(),
      // The full client page has its own (stricter) access rule.
      canOpenClientPage: fullAccess,
      limited: !fullAccess,
      linked: !membership.conversation.projectId,
      timeline: rows.slice(-200),
    },
  };
}

/** Owner/admin of a regular group links it to a client they can see (or unlinks it). */
export async function linkConversationToProject(actor: ChatActor, conversationId: string, projectId: unknown) {
  const membership = await findMembership(conversationId, actor.id);
  if (!membership) return { status: "not_found" as const };
  const c = membership.conversation;
  // Only private groups: a channel can be joined by anyone in the company.
  if (c.type !== "group" || c.projectId) return { status: "forbidden" as const };
  if (!["owner", "admin"].includes(membership.role)) return { status: "forbidden" as const };
  if (!allowAction(`journey-link:${actor.id}`, 20, 60_000)) return { status: "rate_limited" as const };

  let nextId: string | null = null;
  let clientName = "";
  if (typeof projectId === "string" && projectId) {
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, deal: { select: { lead: { select: { name: true } } } } } });
    // You can only show a client to others if you may see that client yourself.
    if (!project || !(await userCanAccessProject(actor.id, actor.role, project.id))) return { status: "not_found" as const };
    nextId = project.id;
    clientName = project.deal?.lead?.name ?? "";
  }
  await prisma.chatConversation.update({ where: { id: conversationId }, data: { linkedProjectId: nextId } });
  await postSystemMessage(conversationId, actor.id, nextId ? `linked:${clientName}` : "unlinked:");
  await notifyMembers(conversationId, await memberIdsOf(conversationId), "updated");
  return { status: "ok" as const };
}

/** Clients the actor may link a group to, by name. */
export async function searchLinkableProjects(actor: ChatActor, query: unknown) {
  if (!allowAction(`journey-search:${actor.id}`, 60, 60_000)) return { status: "rate_limited" as const };
  const q = typeof query === "string" ? query.trim().slice(0, 80) : "";
  // Filter by access in the query itself, so older clients are found too.
  const seesAll = ["super_admin", "general_manager", "head_account_manager", "chief_sales"].includes(actor.role);
  const mine: Prisma.ProjectWhereInput = seesAll
    ? {}
    : {
        OR: [
          { accountManagerId: actor.id },
          { headTechnicalId: actor.id },
          { headSeoId: actor.id },
          { deal: { salesAgentId: actor.id } },
          { teamAssignments: { some: { userId: actor.id, status: "active" } } },
        ],
      };
  const byName: Prisma.ProjectWhereInput = q ? { deal: { lead: { name: { contains: q, mode: "insensitive" } } } } : {};
  const rows = await prisma.project.findMany({
    where: { AND: [mine, byName] },
    orderBy: { createdAt: "desc" },
    take: 15,
    select: { id: true, package: true, projectStatus: true, deal: { select: { lead: { select: { name: true } } } } },
  });
  return { status: "ok" as const, projects: rows.map((r) => ({ id: r.id, clientName: r.deal?.lead?.name ?? "—", package: r.package, projectStatus: r.projectStatus })) };
}
