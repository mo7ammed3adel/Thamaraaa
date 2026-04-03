import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ClientFullJourneyClient from "./ClientFullJourneyClient";

/**
 * Server component for the Client Full Journey page.
 * Fetches all data about a project/client across the entire lifecycle.
 * Accessible by most roles — this is the central truth page.
 */
export default async function ClientJourneyPage({
  params,
}: {
  params: { projectId: string };
}) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;

  if (!user) redirect("/login");

  const project = await prisma.project.findUnique({
    where: { id: params.projectId },
    include: {
      accountManager: true,
      deal: {
        include: {
          lead: {
            include: {
              callLogs: { include: { agent: true }, orderBy: { createdAt: "asc" } },
              meetings: {
                include: { teleAgent: true, salesAgent: true },
                orderBy: { createdAt: "asc" },
              },
            },
          },
          salesAgent: true,
          installments: { orderBy: { dueDate: "asc" } },
        },
      },
      tasks: {
        include: {
          leader: true,
          agent: true,
          subTasks: { include: { leader: true, agent: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      files: { orderBy: { createdAt: "desc" } },
      logs: { orderBy: { createdAt: "desc" } },
      globalNotes: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!project) redirect("/dashboard");

  return (
    <ClientFullJourneyClient
      project={project}
      userRole={user.role}
      userId={user.id}
      userName={user.name}
    />
  );
}
