import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { cookies } from "next/headers";
import { prisma } from "./prisma";
import bcrypt from "bcryptjs";

/** Cookie that carries an active impersonation as "<impersonatorId>:<targetId>". */
export const IMPERSONATION_COOKIE = "imp_session";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email/Phone", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const identifier = credentials.email.trim();
        let user;
        try {
          user = await prisma.user.findFirst({
            where: {
              OR: [
                { email: identifier },
                { phone: identifier },
                // Allow signing in with the auto-generated Employee ID (username).
                { hrRecord: { is: { employeeCode: identifier } } },
              ],
            },
          });
        } catch (dbError) {
          console.error("Prisma login error:", dbError);
          return null;
        }

        if (!user || user.status === "Inactive") return null;

        const isPasswordValid = await bcrypt.compare(credentials.password, user.passwordHash);

        if (!isPasswordValid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          level: user.level || undefined,
          mustChangePassword: user.mustChangePassword || false,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.level = user.level;
        token.mustChangePassword = (user as any).mustChangePassword || false;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.level = token.level;
        session.user.mustChangePassword = token.mustChangePassword || false;
      }

      // Super-admin impersonation overlay: when a super_admin has an active
      // impersonation cookie, every getServerSession() resolves to the target
      // user so the whole app behaves exactly as that user. The real identity
      // stays in the JWT (token), which is never mutated — that's how "exit"
      // and the impersonate routes recover the admin.
      if (token?.role === "super_admin" && session.user) {
        try {
          const raw = cookies().get(IMPERSONATION_COOKIE)?.value;
          if (raw) {
            const sep = raw.indexOf(":");
            const impersonatorId = sep >= 0 ? raw.slice(0, sep) : "";
            const targetId = sep >= 0 ? raw.slice(sep + 1) : "";
            if (impersonatorId === token.id && targetId && targetId !== token.id) {
              const target = await prisma.user.findUnique({
                where: { id: targetId },
                select: { id: true, name: true, email: true, role: true, level: true },
              });
              if (target) {
                session.user.impersonatedBy = { id: token.id as string, name: session.user.name };
                session.user.id = target.id;
                session.user.role = target.role;
                session.user.name = target.name;
                session.user.email = target.email;
                session.user.level = target.level || undefined;
              }
            }
          }
        } catch {
          // cookies() may be unavailable outside a request scope — ignore.
        }
      }

      return session;
    },
  },
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  pages: { signIn: "/login" },
};
