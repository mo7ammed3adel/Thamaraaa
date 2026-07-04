import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { changeUserPresenceStatus } from "@/server/services/userService";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    const actor = session?.user as any;

    if (!session || !actor?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { status } = await request.json();

    const result = await changeUserPresenceStatus({
      actor: { id: actor.id, role: actor.role },
      id: params.id,
      status,
    });

    if (result.status === "invalid_status") {
      return NextResponse.json({ error: "Invalid status format" }, { status: 400 });
    }
    if (result.status === "not_found") {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (result.status === "forbidden") {
      return NextResponse.json({ error: "Forbidden: you cannot update this user's status" }, { status: 403 });
    }

    return NextResponse.json(result.user);
  } catch (error) {
    console.error("Failed to update status:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
