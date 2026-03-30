import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as any)?.role;
    if (userRole !== "account_manager" && userRole !== "super_admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { projectId, packageType, seoLeaderId, socialLeaderId } = await req.json();

    const tasksToCreate = [];

    const seoChecklist = JSON.stringify([
      { id: "seo1", title: "Keyword Research & Strategy", completed: false },
      { id: "seo2", title: "On-Page Optimization", completed: false },
      { id: "seo3", title: "Technical Audit & Fixes", completed: false },
      { id: "seo4", title: "Backlink Setup", completed: false }
    ]);

    const socialChecklist = JSON.stringify([
      { id: "sm1", title: "Competitor Analysis", completed: false },
      { id: "sm2", title: "Content Calendar Creation", completed: false },
      { id: "sm3", title: "Prepare Design Assets", completed: false },
      { id: "sm4", title: "Schedule Initial Posts", completed: false }
    ]);

    if (packageType === "SEO" || packageType === "Full") {
      if (seoLeaderId) {
        tasksToCreate.push({
          projectId,
          leaderId: seoLeaderId,
          title: "Technical SEO Audit & Setup",
          taskType: "SEO",
          checklistItems: seoChecklist,
          deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
        });
      }
    }

    if (packageType === "Social" || packageType === "Full") {
      if (socialLeaderId) {
        tasksToCreate.push({
          projectId,
          leaderId: socialLeaderId,
          title: "Social Media Strategy & Content Calendar",
          taskType: "Social_Media",
          checklistItems: socialChecklist,
          deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) // 5 days from now
        });
      }
    }

    if (tasksToCreate.length === 0) {
      return NextResponse.json({ error: "No leaders available to assign" }, { status: 400 });
    }

    await prisma.task.createMany({ data: tasksToCreate });

    return NextResponse.json({ success: true, count: tasksToCreate.length }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
