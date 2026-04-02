import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import HeadTechnicalClient from "./HeadTechnicalClient";

export default async function HeadTechnicalPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;

  if (!["super_admin", "head_technical"].includes(user?.role)) {
    redirect("/dashboard");
  }

  const projects = await prisma.project.findMany({
    where: { projectStatus: { in: ["assigned", "in_progress", "setup"] } },
    include: {
      deal: { include: { lead: true } },
      accountManager: true,
      tasks: { include: { leader: true, agent: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Fetch team leaders that head_technical can assign to
  const teamLeaders = await prisma.user.findMany({
    where: {
      role: { in: ["team_leader_social_media", "team_leader_media_buyer"] },
      status: "Active",
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Head Technical Dashboard</h1>
      <HeadTechnicalClient projects={projects} teamLeaders={teamLeaders} userId={user.id} />
    </div>
  );
}
