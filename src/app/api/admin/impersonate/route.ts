export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { IMPERSONATION_COOKIE } from "@/lib/auth";
import { findUserExists } from "@/server/repositories/userRepository";

/**
 * Super-admin impersonation. Authorization always uses the raw JWT (getToken),
 * never getServerSession — the session is already overlaid with the target user
 * while impersonating, but the JWT keeps the real super_admin identity.
 */

// Start impersonating a user.
export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token || token.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const userId = typeof body?.userId === "string" ? body.userId.trim() : "";
  if (!userId || userId === token.id) {
    return NextResponse.json({ error: "Invalid target user" }, { status: 400 });
  }

  const target = await findUserExists(userId);
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const res = NextResponse.json({ success: true });
  res.cookies.set(IMPERSONATION_COOKIE, `${token.id}:${userId}`, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 8, // 8 hours
  });
  return res;
}

// Stop impersonating (return to the super_admin).
export async function DELETE(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token || token.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const res = NextResponse.json({ success: true });
  res.cookies.set(IMPERSONATION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  });
  return res;
}
