import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const { dealId, packageId, niche, deadline } = await request.json();
    if (!dealId || !packageId) {
      return NextResponse.json({ error: "Deal ID and Package ID are required" }, { status: 400 });
    }

    // Attempt to automatically find an Account Manager if not explicitly provided
    // By default, we query for a Head Account Manager or Account Manager
    const accountManager = await prisma.user.findFirst({
        where: { role: { in: ["head_account_manager", "account_manager"] }, status: "Active" },
        orderBy: { createdAt: "asc" }
    });

    if (!accountManager) {
        return NextResponse.json({ error: "No Account Manager found in the system to assign to." }, { status: 400 });
    }

    let pkg;
    const dealData = await prisma.deal.findUnique({ where: { id: dealId } });
    if (packageId) {
        pkg = await prisma.package.findUnique({ where: { id: packageId } });
    } else if (dealData?.package) {
        pkg = await prisma.package.findUnique({ where: { name: dealData.package } });
    }

    if (!pkg) {
      return NextResponse.json({ error: "Package mapping not found for deal" }, { status: 404 });
    }

    const newProject = await prisma.project.create({
      data: {
        dealId,
        accountManagerId: accountManager.id,
        niche: niche || null,
        package: pkg.name,
        packageId: pkg.id,
        technicalDeadline: deadline ? new Date(deadline) : null,
        finalDeadline: deadline ? new Date(deadline) : null,
        projectStatus: "setup",
      }
    });

    // Log the setup
    await prisma.projectLog.create({
      data: {
        projectId: newProject.id,
        action: "setup",
        details: `Project assigned to AM ${accountManager.name}`,
        userId
      }
    });

    // Send notification to AM
    await prisma.notification.create({
        data: {
            userId: accountManager.id,
            title: "New Project Assigned",
            message: `A new project has been created from a closed deal and assigned to you.`,
            type: "deal_closed",
            link: "/dashboard/operations"
        }
    });

    return NextResponse.json(newProject);
  } catch (error) {
    console.error("Failed to setup project:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
