import { prisma } from "@/lib/prisma";
import { MAX_NAME_LENGTH } from "@/lib/chat/constants";
import { memberIdsOf, notifyMembers, postSystemMessage } from "./chatService";

/**
 * Every client project gets its own private chat group the moment it reaches
 * the technical stage (a Head Technical is assigned).
 *
 * Membership follows the project assignment, both ways: whoever is assigned
 * is added (and, like any member, sees the whole history); whoever is taken
 * off the project is removed, so nobody keeps reading a client they no longer
 * work on. Those memberships are marked autoAdded. The current Head Technical
 * owns the group and the Head Account Manager administers it; people an
 * owner/admin adds by hand are left alone.
 *
 * Call syncProjectChat(projectId) after anything that assigns or unassigns
 * people. It is idempotent and never throws: an assignment must never fail
 * because of chat.
 */

/** Roles that can be pulled in through a task (not admins or sales). */
const TASK_ROLES = /^(team_leader|leader_|agent_|operations_agent)/;
const DONE_TASK = ["done"];

type Assignees = {
  inTechnical: boolean;
  headTechnicalId: string | null;
  headAccountManagerId: string | null;
  groupName: string;
  /** Active employees assigned right now. */
  users: { id: string; name: string }[];
};

/** Everyone currently assigned to the project, in any role. */
export async function projectAssignees(projectId: string): Promise<Assignees | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      headTechnicalId: true,
      headAccountManagerId: true,
      accountManagerId: true,
      headSeoId: true,
      deal: { select: { lead: { select: { name: true } } } },
      teamAssignments: { select: { userId: true, status: true } },
      tasks: { where: { status: { notIn: DONE_TASK } }, select: { leaderId: true, agentId: true } },
    },
  });
  if (!project) return null;

  const direct = new Set<string>();
  for (const id of [project.headTechnicalId, project.headAccountManagerId, project.accountManagerId, project.headSeoId]) if (id) direct.add(id);
  project.teamAssignments.filter((a) => a.status === "active").forEach((a) => direct.add(a.userId));
  // Someone taken off the team keeps their old task rows; that alone is not access.
  const removed = new Set(project.teamAssignments.filter((a) => a.status !== "active").map((a) => a.userId));
  const viaTasks = new Set<string>();
  project.tasks.forEach((t) => [t.leaderId, t.agentId].forEach((id) => id && !removed.has(id) && viaTasks.add(id)));

  const candidates = Array.from(new Set([...Array.from(direct), ...Array.from(viaTasks)]));
  const people = await prisma.user.findMany({ where: { id: { in: candidates }, status: "Active" }, select: { id: true, name: true, role: true } });
  const users = people.filter((p) => direct.has(p.id) || TASK_ROLES.test(p.role)).map((p) => ({ id: p.id, name: p.name }));

  const clientName = project.deal?.lead?.name?.trim();
  return {
    inTechnical: Boolean(project.headTechnicalId),
    headTechnicalId: project.headTechnicalId,
    headAccountManagerId: project.headAccountManagerId,
    groupName: (clientName || `عميل ${projectId.slice(0, 6)}`).slice(0, MAX_NAME_LENGTH),
    users,
  };
}

export async function syncProjectChat(projectId: string): Promise<void> {
  try {
    await sync(projectId);
  } catch (error) {
    console.error("Project chat sync failed:", projectId, error);
  }
}

function roleFor(userId: string, info: Assignees): "owner" | "admin" | "member" {
  if (userId === info.headTechnicalId) return "owner";
  if (userId === info.headAccountManagerId) return "admin";
  return "member";
}

async function sync(projectId: string) {
  const info = await projectAssignees(projectId);
  if (!info) return;
  const assigned = new Map(info.users.map((u) => [u.id, u]));

  // The whole reconcile runs under one per-project lock, so two assignments at
  // the same moment can't both add (and announce) the same person.
  const outcome = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`project-chat:${projectId}`}))`;
    let group = await tx.chatConversation.findUnique({ where: { projectId }, select: { id: true } });
    let created = false;
    if (!group) {
      // Groups start when the project reaches technical, with someone in it.
      if (!info.inTechnical || assigned.size === 0) return null;
      group = await tx.chatConversation.create({
        data: {
          type: "group",
          projectId,
          name: info.groupName,
          description: "جروب العميل — اتعمل تلقائي لما المشروع دخل التيكنكل",
          isPrivate: true,
          createdById: info.headTechnicalId && assigned.has(info.headTechnicalId) ? info.headTechnicalId : null,
          lastMessageAt: new Date(),
        },
        select: { id: true },
      });
      created = true;
    }

    const members = await tx.chatMember.findMany({ where: { conversationId: group.id }, include: { user: { select: { name: true } } } });
    const byUser = new Map(members.map((m) => [m.userId, m]));

    const added: { id: string; name: string }[] = [];
    for (const u of Array.from(assigned.values())) {
      const existing = byUser.get(u.id);
      if (!existing) {
        await tx.chatMember.create({ data: { conversationId: group.id, userId: u.id, role: roleFor(u.id, info), autoAdded: true } });
        added.push(u);
      } else if (existing.autoAdded && existing.role !== roleFor(u.id, info)) {
        // A new Head Technical takes over ownership; the old one steps down.
        await tx.chatMember.update({ where: { id: existing.id }, data: { role: roleFor(u.id, info) } });
      }
    }

    const removed: string[] = [];
    for (const m of members) {
      if (m.autoAdded && !assigned.has(m.userId)) {
        await tx.chatMember.delete({ where: { id: m.id } });
        removed.push(m.user.name);
      }
    }
    return { conversationId: group.id, created, added, removed };
  });

  if (!outcome || (!outcome.created && outcome.added.length === 0 && outcome.removed.length === 0)) return;
  const { conversationId } = outcome;
  const announcer = info.headTechnicalId && assigned.has(info.headTechnicalId) ? info.headTechnicalId : outcome.added[0]?.id;
  if (outcome.created && announcer) await postSystemMessage(conversationId, announcer, `created:${info.groupName}`);
  if (!outcome.created && outcome.added.length && announcer) {
    await postSystemMessage(conversationId, outcome.added[0].id, `joined:${outcome.added.map((u) => u.name).join("، ")}`);
  }
  if (outcome.removed.length && announcer) await postSystemMessage(conversationId, announcer, `left:${outcome.removed.join("، ")}`);
  await notifyMembers(conversationId, await memberIdsOf(conversationId), "members");
}

/** One-off: groups for projects that were already in the technical stage. */
export async function backfillProjectChats(): Promise<{ projects: number }> {
  const projects = await prisma.project.findMany({ where: { headTechnicalId: { not: null } }, select: { id: true } });
  for (const p of projects) await syncProjectChat(p.id);
  return { projects: projects.length };
}
