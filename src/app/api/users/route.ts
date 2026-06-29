import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDistributionTargets } from "@/lib/distribution";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;

    if (!user?.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const distributableRoles = getDistributionTargets(user.role);
    const canViewAllUsers = ["super_admin", "hr_manager"].includes(user.role);
    const canViewAccountManagers = user.role === "head_account_manager";
    const canViewTeamLeaders =
      user.role === "head_technical" || user.role === "head_seo";

    const where: any = {};
    if (canViewAllUsers) {
      // no role filter
    } else if (canViewAccountManagers) {
      where.role = { in: ["account_manager"] };
    } else if (canViewTeamLeaders || distributableRoles.length > 0) {
      where.role = { in: distributableRoles };
    } else {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        level: true,
        status: true,
        company: true,
        directManagerId: true,
        directManager: { select: { id: true, name: true } },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ users });
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

    const data = await req.json();

    if (!data.name || !data.email || !data.password || !data.role) {
      return NextResponse.json({ error: "Name, email, password and role are required" }, { status: 400 });
    }

    if (actor.role === "hr_manager" && data.role === "super_admin") {
      return NextResponse.json({ error: "Only Super Admin can create Super Admin accounts" }, { status: 403 });
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

    let assignedManagerId: string | null = data.directManagerId || null;

    // Smart Manager Assignment (Load Balancing) — only when no manager was set explicitly
    if (!assignedManagerId && data.role === "tele_sales_agent") {
      const managers = await prisma.user.findMany({
        where: { role: "tele_sales_manager", status: "Active" },
        include: { _count: { select: { subordinates: true } } },
        orderBy: { subordinates: { _count: "asc" } },
      });
      if (managers.length > 0) {
        assignedManagerId = managers[0].id;
      }
    } else if (!assignedManagerId && data.role === "sales_agent") {
      const managers = await prisma.user.findMany({
        where: { role: "sales_manager", status: "Active" },
        include: { _count: { select: { subordinates: true } } },
        orderBy: { subordinates: { _count: "asc" } },
      });
      if (managers.length > 0) {
        assignedManagerId = managers[0].id;
      }
    }

    // Resolve the company relation (and denormalize its name for HR display).
    const companyId: string | null = data.companyId || null;
    let companyName: string | null = data.company || null;
    if (companyId) {
      const company = await prisma.company.findUnique({ where: { id: companyId } });
      if (!company) return NextResponse.json({ error: "Selected company not found" }, { status: 400 });
      companyName = company.name;
    }

    const level = data.level || "Junior";
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: data.name,
          email: data.email,
          phone: data.phone || null,
          passwordHash: hashedPassword,
          role: data.role,
          level,
          status: data.status || "Active",
          company: companyName,
          companyId,
          directManagerId: assignedManagerId,
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          level: true,
          status: true,
          company: true,
          companyId: true,
          companyRef: { select: { id: true, name: true } },
          createdAt: true,
          directManagerId: true,
          directManager: { select: { id: true, name: true } },
        }
      });

      // Every employee gets an HrRecord that holds the financial/performance fields.
      await tx.hrRecord.create({
        data: {
          userId: created.id,
          baseSalary: Number(data.baseSalary) || 0,
          level,
          monthlyTarget: Number(data.monthlyTarget) || 0,
          performanceHistory: "[]",
        },
      });

      return created;
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
