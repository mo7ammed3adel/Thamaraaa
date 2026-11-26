import { NextResponse } from "next/server";
import { withAuth, type NextRequestWithAuth } from "next-auth/middleware";
import { guardedAction } from "@/lib/gmPolicy";

/**
 * Global route protection middleware — EMPLOYEES ONLY.
 * Redirects unauthenticated users to /login for all dashboard and API routes.
 * The /api/auth/* routes are excluded to allow the login flow itself.
 *
 * The client portal (/portal and /api/portal/*), the desktop monitoring agent
 * (/api/agent/*) and the scheduled jobs (/api/cron/*) are intentionally outside
 * this matcher: none of them is a NextAuth user. The portal authenticates via
 * readClientSession(); the agent presents a device token and the cron jobs a
 * CRON_SECRET bearer token, both of which their own routes verify. The LiveKit
 * webhook (/api/livekit/*) is signed with the LiveKit API secret instead. Without this
 * exclusion a scheduler would be redirected to /login and the job never runs.
 *
 * General managers: every API request that edits or deletes data (see
 * gmPolicy) is checked against the grants the super admin gave them, read
 * fresh from the database, so a revoked grant stops working at once. This is
 * the one place that enforces it — routes keep treating the GM like a super
 * admin for everything else.
 */
const INTERNAL_ORIGIN = `http://127.0.0.1:${process.env.PORT || 3000}`;

async function gmGrants(req: NextRequestWithAuth): Promise<{ canEdit: boolean; canDelete: boolean } | null> {
  try {
    const res = await fetch(`${INTERNAL_ORIGIN}/api/me/permissions`, {
      headers: { cookie: req.headers.get("cookie") ?? "" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as { canEdit: boolean; canDelete: boolean };
  } catch {
    return null;
  }
}

/** How long a role in the session cookie is trusted without asking the database. */
const ROLE_TRUST_MS = 60_000;

export default withAuth(
  async function middleware(req: NextRequestWithAuth) {
    const token = req.nextauth.token;
    const action = guardedAction(req.method, req.nextUrl.pathname, token?.id);
    if (!action) return NextResponse.next();
    // A cookie can carry an old role (e.g. someone just made a GM, or a
    // demoted admin): unless it was confirmed recently, ask the database.
    const fresh = Date.now() - Number(token?.roleCheckedAt ?? 0) < ROLE_TRUST_MS;
    if (token?.role !== "general_manager" && fresh) return NextResponse.next();
    const grants = await gmGrants(req);
    // Can't ask (e.g. a hiccup): a known GM is refused; anyone else whose cookie
    // is merely old carries on rather than being blocked from their work.
    if (!grants && token?.role !== "general_manager") return NextResponse.next();
    const allowed = action === "edit" ? grants?.canEdit : grants?.canDelete;
    if (allowed) return NextResponse.next();
    return NextResponse.json(
      { error: action === "edit" ? "مش مسموحلك تعدّل — اطلب الصلاحية من الأدمن" : "مش مسموحلك تمسح — اطلب الصلاحية من الأدمن", code: `gm_${action}_forbidden` },
      { status: 403 }
    );
  },
  {
    pages: {
      signIn: "/login",
    },
  }
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/((?!auth|portal|agent|cron|livekit).*)",
  ],
};
