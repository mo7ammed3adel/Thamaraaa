import { prisma } from "@/lib/prisma";

type NoteWhereClause = {
  projectId: string;
  category?: string;
  userId?: string;
  createdAt?: {
    gte?: Date;
    lte?: Date;
  };
};

export async function findNotesWithCount(input: {
  where: NoteWhereClause;
  page: number;
  limit: number;
}) {
  const [totalCount, notes] = await Promise.all([
    prisma.note.count({ where: input.where }),
    prisma.note.findMany({
      where: input.where,
      orderBy: { createdAt: "desc" },
      skip: (input.page - 1) * input.limit,
      take: input.limit,
    }),
  ]);

  return { totalCount, notes };
}

export function createNote(input: {
  projectId: string;
  content: string;
  category: string;
  userId: string;
  userRole: string;
  userName: string;
}) {
  return prisma.note.create({
    data: input,
  });
}
