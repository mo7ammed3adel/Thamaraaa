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

/**
 * `user-${id}` is a public Pusher channel, so the event carries no content —
 * only a "go refetch" signal. Clients load the real notification through the
 * authenticated API. (Nothing reads the payload.)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function realtimePayload(_input: Omit<NotifyInput, "userId">) {
  return { t: Date.now() };
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

/**
 * Realtime-only half of notifyUser, for notification rows that were already
 * persisted inside a DB transaction (so the row commits or rolls back together
 * with the assignment itself). Call it AFTER the transaction commits.
 */
export async function announceNotifications(rows: NotifyInput[]): Promise<void> {
  await Promise.all(
    rows.map((row) => safeTrigger(`user-${row.userId}`, "new-notification", realtimePayload(row)))
  );
}
