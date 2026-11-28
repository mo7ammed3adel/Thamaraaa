/** Personal folders inside each chat sidebar section — shared by server and UI. */

export const FOLDER_SECTIONS = ["channel", "group", "dm"] as const;
export type FolderSection = (typeof FOLDER_SECTIONS)[number];
export const MAX_FOLDERS_PER_SECTION = 20;

/**
 * Where a dragged conversation lands: in `folderId` (null = out of every
 * folder), just before `beforeId`, or at the end when that's left out.
 */
export type DropTarget = { folderId: string | null; beforeId?: string };

/**
 * Splits a section's conversations into your folders (in folder order, each
 * keeping its saved order) and the loose ones left over. A conversation the
 * folder lists but you can't see right now is simply skipped.
 */
export function groupIntoFolders<C extends { id: string }, F extends { id: string; conversationIds: string[] }>(items: C[], folders: F[]) {
  const byId = new Map(items.map((c) => [c.id, c]));
  const placed = new Set<string>();
  const grouped = folders.map((folder) => {
    const inside: C[] = [];
    for (const id of folder.conversationIds) {
      const c = byId.get(id);
      if (c && !placed.has(id)) {
        inside.push(c);
        placed.add(id);
      }
    }
    return { folder, items: inside };
  });
  return { grouped, loose: items.filter((c) => !placed.has(c.id)) };
}

/** The folders after moving one conversation, for an optimistic update. */
export function applyMove<F extends { id: string; conversationIds: string[] }>(folders: F[], conversationId: string, target: DropTarget): F[] {
  return folders.map((f) => {
    if (f.id !== target.folderId) {
      const without = f.conversationIds.filter((id) => id !== conversationId);
      return without.length === f.conversationIds.length ? f : { ...f, conversationIds: without };
    }
    return { ...f, conversationIds: placeBefore(f.conversationIds, conversationId, target.beforeId) };
  });
}

/**
 * Moves `id` to just before `beforeId` (or to the end when that's missing or
 * is `id` itself). Removing first and then looking `beforeId` up keeps the
 * result right whether the item moves up or down.
 */
export function placeBefore(ids: string[], id: string, beforeId?: string | null): string[] {
  const without = ids.filter((x) => x !== id);
  const at = beforeId && beforeId !== id ? without.indexOf(beforeId) : -1;
  return at < 0 ? [...without, id] : [...without.slice(0, at), id, ...without.slice(at)];
}
