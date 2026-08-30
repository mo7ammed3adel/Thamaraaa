import { withAuth } from "next-auth/middleware";

/**
 * Global route protection middleware — EMPLOYEES ONLY.
 * Redirects unauthenticated users to /login for all dashboard and API routes.
 * The /api/auth/* routes are excluded to allow the login flow itself.
 *
 * The client portal (/portal and /api/portal/*) is intentionally outside this
 * matcher: customers are not NextAuth users, so they carry no employee session.
 * Those routes authenticate themselves via readClientSession().
 */
export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/((?!auth|portal).*)",
  ],
};
