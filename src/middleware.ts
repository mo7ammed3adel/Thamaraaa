import { withAuth } from "next-auth/middleware";

/**
 * Global route protection middleware — EMPLOYEES ONLY.
 * Redirects unauthenticated users to /login for all dashboard and API routes.
 * The /api/auth/* routes are excluded to allow the login flow itself.
 *
 * The client portal (/portal and /api/portal/*) and the desktop monitoring agent
 * (/api/agent/*) are intentionally outside this matcher: neither is a NextAuth
 * user. The portal authenticates via readClientSession(); the agent presents a
 * device token its routes verify themselves.
 */
export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/((?!auth|portal|agent).*)",
  ],
};
