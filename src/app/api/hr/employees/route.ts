import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

function isHrManager(role?: string) {
  return role === "hr_manager" || role === "super_admin";
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user?.role !== "hr_manager" && session.user?.role !== "super_admin")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const employees = await prisma.user.findMany({
      include: {
        hrRecord: true,
        attendances: {
          take: 5,
          orderBy: { date: "desc" }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json({ employees });
  } catch (error) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/**
 * POST /api/hr/employees
 * Creates a full employee: a User row plus the linked HrRecord that holds
 * the financial/performance fields (baseSalary, monthlyTarget, level).
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!isHrManager((session?.user as any)?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await req.json();
    if (!data.name || !data.email || !data.password || !data.role) {
      return NextResponse.json({ error: "Name, email, password and role are required" }, { status: 400 });
    }

    const orClauses: Array<Record<string, string>> = [{ email: data.email }];
    if (data.phone) orClauses.push({ phone: data.phone });
    const existing = await prisma.user.findFirst({ where: { OR: orClauses } });
    if (existing) {
      const conflict = existing.email === data.email ? "email" : "phone";
      return NextResponse.json({ error: `A user with this ${conflict} already exists` }, { status: 400 });
    }

    const level = data.level || "Junior";
    const baseSalary = Number(data.baseSalary) || 0;
    const monthlyTarget = Number(data.monthlyTarget) || 0;
    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: data.name,
          email: data.email,
          phone: data.phone || null,
          passwordHash: hashedPassword,
          role: data.role,
          level,
          company: data.company || null,
          status: data.status || "Active",
          directManagerId: data.directManagerId || null,
        },
        select: { id: true, name: true, email: true, role: true, level: true, status: true },
      });

      await tx.hrRecord.create({
        data: {
          userId: created.id,
          baseSalary,
          level,
          monthlyTarget,
          performanceHistory: "[]",
        },
      });

      await tx.notification.create({
        data: {
          userId: created.id,
          title: "Welcome to Thamara",
          message: "Your account has been created. You can now sign in.",
          link: "/dashboard",
        },
      });

      return created;
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating employee:", error);
    const msg = error?.code === "P2002" ? "A user with this email or phone already exists" : "Internal Server Error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * PATCH /api/hr/employees
 * Updates an employee's User fields and HrRecord (salary/target/level).
 * Also used for the Active/Inactive toggle.
 */
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!isHrManager((session?.user as any)?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await req.json();
    if (!data.id) {
      return NextResponse.json({ error: "Employee id is required" }, { status: 400 });
    }

    const userData: any = {};
    if (data.name !== undefined) userData.name = data.name;
    if (data.role !== undefined) userData.role = data.role;
    if (data.phone !== undefined) userData.phone = data.phone || null;
    if (data.status !== undefined) userData.status = data.status;
    if (data.level !== undefined) userData.level = data.level;
    if (data.company !== undefined) userData.company = data.company || null;
    if (data.directManagerId !== undefined) userData.directManagerId = data.directManagerId || null;

    const updated = await prisma.user.update({
      where: { id: data.id },
      data: userData,
      select: { id: true, name: true, role: true, status: true, level: true },
    });

    // Sync HrRecord fields if any were provided
    const hrData: any = {};
    if (data.baseSalary !== undefined) hrData.baseSalary = Number(data.baseSalary) || 0;
    if (data.monthlyTarget !== undefined) hrData.monthlyTarget = Number(data.monthlyTarget) || 0;
    if (data.level !== undefined) hrData.level = data.level;

    if (Object.keys(hrData).length > 0) {
      await prisma.hrRecord.upsert({
        where: { userId: data.id },
        update: hrData,
        create: {
          userId: data.id,
          baseSalary: hrData.baseSalary || 0,
          level: hrData.level || updated.level || "Junior",
          monthlyTarget: hrData.monthlyTarget || 0,
          performanceHistory: "[]",
        },
      });
    }

    return NextResponse.json({ user: updated });
  } catch (error: any) {
    console.error("Error updating employee:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
