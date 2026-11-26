import { prisma } from "@/lib/prisma";
import { LABEL_COLORS, MAX_LABELS, MAX_LABEL_NAME } from "@/lib/chat/labels";
import { findMembership, type ChatActor } from "./chatService";
import { allowAction } from "./rateLimit";

/**
 * Personal labels on conversations (WhatsApp Business style): sort clients by
 * status and colleagues by specialty, your own way. Every label belongs to
 * one employee and only ever appears to them.
 */

function cleanName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, MAX_LABEL_NAME);
  return name || null;
}

function cleanColor(value: unknown): string | null {
  return typeof value === "string" && (LABEL_COLORS as readonly string[]).includes(value) ? value : null;
}

/** Your labels, each with the conversations you put it on. */
export async function listLabels(actor: ChatActor) {
  const labels = await prisma.chatLabel.findMany({
    where: { userId: actor.id },
    orderBy: { createdAt: "asc" },
    include: { links: { select: { conversationId: true } } },
  });
  return {
    status: "ok" as const,
    labels: labels.map((l) => ({ id: l.id, name: l.name, color: l.color, conversationIds: l.links.map((x) => x.conversationId) })),
  };
}

export async function createLabel(actor: ChatActor, input: { name?: unknown; color?: unknown }) {
  if (!allowAction(`labels:${actor.id}`, 30, 60_000)) return { status: "rate_limited" as const };
  const name = cleanName(input.name);
  const color = cleanColor(input.color) ?? LABEL_COLORS[0];
  if (!name) return { status: "invalid" as const, error: "Label name is required" };
  if ((await prisma.chatLabel.count({ where: { userId: actor.id } })) >= MAX_LABELS) return { status: "invalid" as const, error: "Too many labels" };
  try {
    const label = await prisma.chatLabel.create({ data: { userId: actor.id, name, color } });
    return { status: "ok" as const, label: { id: label.id, name: label.name, color: label.color, conversationIds: [] as string[] } };
  } catch {
    return { status: "invalid" as const, error: "You already have a label with that name" };
  }
}

export async function updateLabel(actor: ChatActor, labelId: string, input: { name?: unknown; color?: unknown }) {
  const label = await prisma.chatLabel.findFirst({ where: { id: labelId, userId: actor.id } });
  if (!label) return { status: "not_found" as const };
  const data: { name?: string; color?: string } = {};
  if (input.name !== undefined) {
    const name = cleanName(input.name);
    if (!name) return { status: "invalid" as const, error: "Label name is required" };
    data.name = name;
  }
  if (input.color !== undefined) {
    const color = cleanColor(input.color);
    if (!color) return { status: "invalid" as const, error: "Unknown color" };
    data.color = color;
  }
  try {
    await prisma.chatLabel.update({ where: { id: label.id }, data });
  } catch {
    return { status: "invalid" as const, error: "You already have a label with that name" };
  }
  return { status: "ok" as const };
}

export async function deleteLabel(actor: ChatActor, labelId: string) {
  const deleted = await prisma.chatLabel.deleteMany({ where: { id: labelId, userId: actor.id } });
  return deleted.count ? { status: "ok" as const } : { status: "not_found" as const };
}

/** Sets which of your labels are on a conversation you're in. */
export async function setConversationLabels(actor: ChatActor, conversationId: string, labelIds: unknown) {
  if (!(await findMembership(conversationId, actor.id))) return { status: "not_found" as const };
  if (!allowAction(`labels:${actor.id}`, 60, 60_000)) return { status: "rate_limited" as const };
  const wanted = Array.isArray(labelIds) ? Array.from(new Set(labelIds.filter((x): x is string => typeof x === "string"))).slice(0, MAX_LABELS) : [];
  // Only your own labels; anyone else's id is silently dropped.
  const mine = await prisma.chatLabel.findMany({ where: { userId: actor.id }, select: { id: true } });
  const mineIds = mine.map((l) => l.id);
  const keep = wanted.filter((id) => mineIds.includes(id));
  await prisma.$transaction([
    prisma.chatConversationLabel.deleteMany({ where: { conversationId, labelId: { in: mineIds, notIn: keep } } }),
    prisma.chatConversationLabel.createMany({ data: keep.map((labelId) => ({ labelId, conversationId })), skipDuplicates: true }),
  ]);
  return { status: "ok" as const, labelIds: keep };
}
