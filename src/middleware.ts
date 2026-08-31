import { withAuth } from "next-auth/middleware";

/**
 * Global route protection middleware — EMPLOYEES ONLY.
 * Redirects unauthenticated users to /login for all dashboard and API routes.
 * The /api/auth/* routes are excluded to allow the login flow itself.
 *
 * The client portal (/portal and /api/portal/*), the desktop monitoring agent
 * (/api/agent/*) and the scheduled jobs (/api/cron/*) are intentionally outside
 * this matcher: none of them is a NextAuth user. The portal authenticates via
 * readClientSession(); the agent presents a device token and the cron jobs a
 * CRON_SECRET bearer token, both of which their own routes verify. Without this
 * exclusion a scheduler would be redirected to /login and the job never runs.
 */
export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/((?!auth|portal|agent|cron).*)",
  ],
};
