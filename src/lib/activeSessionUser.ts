import { prisma } from "./prisma";

type SessionUserLike = {
  id?: string | null;
  email?: string | null;
};

export async function getActiveSessionUser(sessionUser: SessionUserLike | null | undefined) {
  if (!sessionUser?.id && !sessionUser?.email) {
    return null;
  }

  if (sessionUser.id) {
    const user = await prisma.user.findFirst({
      where: { id: sessionUser.id, status: "Active" },
      select: { id: true, name: true, email: true, role: true, status: true },
    });
    if (user) return user;
  }

  if (sessionUser.email) {
    return prisma.user.findFirst({
      where: { email: sessionUser.email, status: "Active" },
      select: { id: true, name: true, email: true, role: true, status: true },
    });
  }

  return null;
}
