import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PipelineClient from "./PipelineClient";

/**
 * Server component for the Chief Sales Pipeline page.
 * Fetches deals, projects, and lead data for a visual pipeline view.
 */
export default async function PipelinePage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;

  if (!["super_admin", "chief_sales"].includes(user?.role)) {
    redirect("/dashboard");
  }

  const deals = await prisma.deal.findMany({
    include: {
      lead: true,
      salesAgent: true,
      projects: { include: { accountManager: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const projects = await prisma.project.findMany({
    include: {
      deal: { include: { lead: true, salesAgent: true } },
      accountManager: true,
      tasks: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Sales Pipeline</h1>
      <PipelineClient deals={deals} projects={projects} />
    </div>
  );
}
