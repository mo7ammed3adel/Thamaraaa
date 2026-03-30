import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userRole = (session?.user as any)?.role;
  if (!["super_admin", "hr_manager"].includes(userRole)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const applicants = await prisma.jobApplicant.findMany({
      orderBy: { createdAt: "desc" }
    });
    return NextResponse.json({ data: applicants }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userRole = (session?.user as any)?.role;
  if (!["super_admin", "hr_manager"].includes(userRole)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const newApplicant = await prisma.jobApplicant.create({
      data: {
        name: body.name,
        email: body.email,
        phone: body.phone,
        roleApplied: body.roleApplied,
        notes: body.notes || null,
        status: "New"
      }
    });
    return NextResponse.json({ data: newApplicant }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
