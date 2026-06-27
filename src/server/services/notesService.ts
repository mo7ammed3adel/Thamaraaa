import { userCanAccessProject } from "@/lib/distribution";
import { createNote, findNotesWithCount } from "@/server/repositories/noteRepository";

export async function listProjectNotes(input: {
  userId: string;
  userRole: string;
  projectId: string;
  category?: string | null;
  authorUserId?: string | null;
  from?: string | null;
  to?: string | null;
  page: number;
  limit: number;
}) {
  const allowed = await userCanAccessProject(input.userId, input.userRole, input.projectId);
  if (!allowed) return { status: "forbidden" as const };

  const where = {
    projectId: input.projectId,
    ...(input.category && input.category !== "all" ? { category: input.category } : {}),
    ...(input.authorUserId && input.authorUserId !== "all" ? { userId: input.authorUserId } : {}),
    ...(input.from || input.to
      ? {
          createdAt: {
            ...(input.from ? { gte: new Date(input.from) } : {}),
            ...(input.to ? { lte: new Date(input.to) } : {}),
          },
        }
      : {}),
  };

  const { totalCount, notes } = await findNotesWithCount({
    where,
    page: input.page,
    limit: input.limit,
  });

  return {
    status: "ok" as const,
    notes,
    pagination: {
      total: totalCount,
      page: input.page,
      limit: input.limit,
      totalPages: Math.ceil(totalCount / input.limit),
    },
  };
}

export async function createProjectNote(input: {
  userId: string;
  userRole: string;
  userName: string;
  projectId: string;
  content: string;
  category?: string | null;
}) {
  const allowed = await userCanAccessProject(input.userId, input.userRole, input.projectId);
  if (!allowed) return { status: "forbidden" as const };

  const note = await createNote({
    projectId: input.projectId,
    content: input.content,
    category: input.category || "general",
    userId: input.userId,
    userRole: input.userRole,
    userName: input.userName,
  });

  return { status: "ok" as const, note };
}
