import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const packages = await prisma.package.findMany({
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json(packages);
  } catch (error) {
    console.error("Failed to fetch packages:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;
    if (!["super_admin", "account_manager"].includes(role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { name, servicesJson } = await request.json();
    if (!name || !servicesJson) {
      return NextResponse.json({ error: "Name and services are required" }, { status: 400 });
    }

    const newPackage = await prisma.package.create({
      data: { name, servicesJson }
    });

    return NextResponse.json(newPackage);
  } catch (error) {
    console.error("Failed to create package:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
