import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type SessionUserLike = {
  id?: string | null;
  email?: string | null;
  name?: string | null;
  role?: string | null;
};

export type SessionUser = SessionUserLike & {
  id: string;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUserLike | undefined;
  return user?.id ? ({ ...user, id: user.id } as SessionUser) : null;
}

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
