import { DefaultSession } from "next-auth";

/**
 * NextAuth type augmentation.
 * Extends the default Session and JWT types to include
 * custom fields (id, role, level) used throughout the CRM.
 * This eliminates the need for `as any` casts on session.user.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      level?: string;
      mustChangePassword?: boolean;
      /** Present only while a super_admin is impersonating this user. */
      impersonatedBy?: { id: string; name?: string | null } | null;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role: string;
    level?: string;
    mustChangePassword?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    level?: string;
    mustChangePassword?: boolean;
  }
}
