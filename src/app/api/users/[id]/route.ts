import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { deleteUserAccount, updateUserAccount } from "@/server/services/userService";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;

    // Allow HR, Super Admin to edit general details.
    if (!user || (!["super_admin", "hr_manager"].includes(user.role))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const result = await updateUserAccount({
      actor: { id: user.id, role: user.role },
      id: params.id,
      body: await req.json(),
    });

    if (result.status === "not_found") {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (result.status === "super_admin_edit_forbidden") {
      return NextResponse.json({ error: "Only Super Admin can create or modify Super Admin accounts" }, { status: 403 });
    }
    if (result.status === "company_not_found") {
      return NextResponse.json({ error: "Selected company not found" }, { status: 400 });
    }

    return NextResponse.json(result.user);
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;

    if (!user || user.role !== "super_admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const result = await deleteUserAccount({ actor: { id: user.id, role: user.role }, id: params.id });

    if (result.status === "self_delete") {
      return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
    }
    if (result.status === "not_found") {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (result.status === "soft_deleted") {
      return NextResponse.json({
        message: "User deactivated (has business history). Records preserved.",
        softDeleted: true,
      });
    }

    return NextResponse.json({ message: "User deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting user:", error);
    const msg =
      error?.code === "P2003"
        ? "Cannot delete: user is still referenced by other records. Try deactivating instead."
        : error?.message || "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
