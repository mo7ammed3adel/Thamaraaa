import { prisma } from "./prisma";
import { safeTrigger } from "./pusher";

/**
 * Centralized in-app notification helper.
 *
 * Persists a Notification row AND pushes a realtime `new-notification` event on
 * the recipient's own channel (`user-${id}`) — the single pattern the
 * NotificationBell consumes. Replaces the create-then-trigger boilerplate that
 * was duplicated across many routes.
 */
export interface NotifyInput {
  userId: string;
  title: string;
  message: string;
  link?: string | null;
  type?: string | null;
  relatedId?: string | null;
}

function realtimePayload(input: Omit<NotifyInput, "userId">) {
  return { title: input.title, message: input.message, link: input.link ?? null };
}

/** Notifies a single user (DB row + realtime event). */
export async function notifyUser(input: NotifyInput): Promise<void> {
  await prisma.notification.create({
    data: {
      userId: input.userId,
      title: input.title,
      message: input.message,
      link: input.link ?? null,
      type: input.type ?? null,
      relatedId: input.relatedId ?? null,
    },
  });
  await safeTrigger(`user-${input.userId}`, "new-notification", realtimePayload(input));
}

/** Notifies many users with the same content (batched DB insert + realtime events). */
export async function notifyUsers(
  userIds: string[],
  input: Omit<NotifyInput, "userId">
): Promise<void> {
  const recipients = Array.from(new Set(userIds));
  if (recipients.length === 0) return;

  await prisma.notification.createMany({
    data: recipients.map((userId) => ({
      userId,
      title: input.title,
      message: input.message,
      link: input.link ?? null,
      type: input.type ?? null,
      relatedId: input.relatedId ?? null,
    })),
  });

  const payload = realtimePayload(input);
  await Promise.all(recipients.map((userId) => safeTrigger(`user-${userId}`, "new-notification", payload)));
}
