import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ProfileClient from "./ProfileClient";

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user) redirect("/login");

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      salesDeals: true,
      attendances: { orderBy: { date: "desc" }, take: 7 },
      leaveRequests: { orderBy: { createdAt: "desc" } },
      documents: true
    }
  });

  if (!profile) return <div>User not found</div>;

  return <ProfileClient profile={profile} />;
}
