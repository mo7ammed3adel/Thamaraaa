import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if ((session?.user as any)?.role !== "super_admin" && (session?.user as any)?.role !== "hr_manager") {
      return NextResponse.json({ error: "Unauthorized — only Super Admin or HR Manager can create users" }, { status: 403 });
    }

    const data = await req.json();

    if (!data.name || !data.email || !data.password || !data.role) {
      return NextResponse.json({ error: "Name, email, password and role are required" }, { status: 400 });
    }

    // Check if user already exists. Build the OR clauses dynamically so we never include an
    // empty `{}` (which would match every row in Prisma OR semantics and break creation).
    const orClauses: Array<Record<string, string>> = [{ email: data.email }];
    if (data.phone) orClauses.push({ phone: data.phone });

    const existing = await prisma.user.findFirst({ where: { OR: orClauses } });

    if (existing) {
      const conflict = existing.email === data.email ? "email" : "phone";
      return NextResponse.json({ error: `A user with this ${conflict} already exists` }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    let assignedManagerId = null;

    // Smart Manager Assignment (Load Balancing)
    if (data.role === "tele_sales_agent") {
      const managers = await prisma.user.findMany({
        where: { role: "tele_sales_manager", status: "Active" },
        include: { _count: { select: { subordinates: true } } },
        orderBy: { subordinates: { _count: "asc" } },
      });
      if (managers.length > 0) {
        assignedManagerId = managers[0].id;
      }
    } else if (data.role === "sales_agent") {
      const managers = await prisma.user.findMany({
        where: { role: "sales_manager", status: "Active" },
        include: { _count: { select: { subordinates: true } } },
        orderBy: { subordinates: { _count: "asc" } },
      });
      if (managers.length > 0) {
        assignedManagerId = managers[0].id;
      }
    }

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone || null,
        passwordHash: hashedPassword,
        role: data.role,
        level: data.level,
        status: data.status,
        directManagerId: assignedManagerId, // Automatically link
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        level: true,
        status: true,
        createdAt: true,
      }
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error: any) {
    console.error("Error creating user:", error);
    const msg =
      error?.code === "P2002"
        ? "A user with this email or phone already exists"
        : error?.message || "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
