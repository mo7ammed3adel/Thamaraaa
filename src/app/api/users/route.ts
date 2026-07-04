import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createUserAccount, listUsersDirectory } from "@/server/services/userService";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;

    if (!user?.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await listUsersDirectory({ id: user.id, role: user.role });
    if (result.status === "forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ users: result.users });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const actor = session?.user as any;
    if (actor?.role !== "super_admin" && actor?.role !== "hr_manager") {
      return NextResponse.json({ error: "Unauthorized — only Super Admin or HR Manager can create users" }, { status: 403 });
    }

    const result = await createUserAccount({
      actor: { id: actor.id, role: actor.role },
      body: await req.json(),
    });

    if (result.status === "missing_fields") {
      return NextResponse.json({ error: "Name, email, password and role are required" }, { status: 400 });
    }
    if (result.status === "super_admin_create_forbidden") {
      return NextResponse.json({ error: "Only Super Admin can create Super Admin accounts" }, { status: 403 });
    }
    if (result.status === "conflict") {
      return NextResponse.json({ error: `A user with this ${result.conflict} already exists` }, { status: 400 });
    }
    if (result.status === "company_not_found") {
      return NextResponse.json({ error: "Selected company not found" }, { status: 400 });
    }

    return NextResponse.json(result.user, { status: 201 });
  } catch (error: any) {
    console.error("Error creating user:", error);
    const msg =
      error?.code === "P2002"
        ? "A user with this email or phone already exists"
        : error?.message || "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
