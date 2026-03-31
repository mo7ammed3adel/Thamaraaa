import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./prisma";
import bcrypt from "bcryptjs";

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

        let user;
        try {
          user = await prisma.user.findFirst({
            where: {
              OR: [{ email: credentials.email.trim() }, { phone: credentials.email.trim() }],
            },
          });
        } catch (dbError) {
          console.error("Prisma login error:", dbError);
          return null;
        }

        if (!user || user.status !== "Active") return null;

        const isPasswordValid = await bcrypt.compare(credentials.password, user.passwordHash);

        if (!isPasswordValid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          level: user.level || undefined,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.level = (user as any).level;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).level = token.level;
      }
      return session;
    },
  },
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
};
