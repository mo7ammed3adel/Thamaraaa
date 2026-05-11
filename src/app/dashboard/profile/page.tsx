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

  // Compute role-aware sales stats so Profile mirrors the role's dashboard.
  // Sales agents close their own deals (Deal.salesAgentId).
  // Telesales agents/managers earn credit through leads they own (Lead.assignedTeleAgentId).
  // Managers aggregate across their team.
  let dealCount = 0;
  let revenue = 0;

  const role = profile.role;
  if (role === "sales_agent" || role === "chief_sales") {
    const agg = await prisma.deal.aggregate({
      where: { salesAgentId: profile.id },
      _count: { _all: true },
      _sum: { totalAmount: true },
    });
    dealCount = agg._count._all;
    revenue = agg._sum.totalAmount || 0;
  } else if (role === "sales_manager") {
    const teamIds = (await prisma.user.findMany({ where: { directManagerId: profile.id }, select: { id: true } })).map(u => u.id);
    const ids = [profile.id, ...teamIds];
    const agg = await prisma.deal.aggregate({
      where: { salesAgentId: { in: ids } },
      _count: { _all: true },
      _sum: { totalAmount: true },
    });
    dealCount = agg._count._all;
    revenue = agg._sum.totalAmount || 0;
  } else if (role === "tele_sales_agent") {
    const agg = await prisma.deal.aggregate({
      where: { lead: { assignedTeleAgentId: profile.id } },
      _count: { _all: true },
      _sum: { totalAmount: true },
    });
    dealCount = agg._count._all;
    revenue = agg._sum.totalAmount || 0;
  } else if (role === "tele_sales_manager") {
    const teamIds = (await prisma.user.findMany({ where: { directManagerId: profile.id }, select: { id: true } })).map(u => u.id);
    const ids = [profile.id, ...teamIds];
    const agg = await prisma.deal.aggregate({
      where: { lead: { assignedTeleAgentId: { in: ids } } },
      _count: { _all: true },
      _sum: { totalAmount: true },
    });
    dealCount = agg._count._all;
    revenue = agg._sum.totalAmount || 0;
  }

  const profileWithStats = {
    ...profile,
    salesStats: { dealCount, revenue },
  };

  return <ProfileClient profile={profileWithStats} />;
}
