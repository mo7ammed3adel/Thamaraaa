import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { changeUserSpecialization } from "@/server/services/userService";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    if (!user || !["super_admin", "tele_sales_manager", "sales_manager", "chief_sales"].includes(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { specialization } = await request.json();

    const result = await changeUserSpecialization({
      actor: { id: user.id, role: user.role },
      id: params.id,
      specialization,
    });

    if (result.status === "unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    if (result.status === "invalid_specialization") {
      return NextResponse.json({ error: "Invalid specialization" }, { status: 400 });
    }
    if (result.status === "not_found") {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (result.status === "forbidden") {
      return NextResponse.json({ error: "Forbidden: you cannot update this user's specialization" }, { status: 403 });
    }

    return NextResponse.json(result.user);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
