import { withAuth } from "next-auth/middleware";

/**
 * Global route protection middleware.
 * Redirects unauthenticated users to /login for all dashboard and API routes.
 * The /api/auth/* routes are excluded to allow the login flow itself.
 */
export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/((?!auth).*)",
  ],
};
