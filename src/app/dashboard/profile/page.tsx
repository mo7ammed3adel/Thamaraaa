import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ProfileClient from "./ProfileClient";
import { getTranslator } from "@/server/i18n/locale";

export default async function ProfilePage() {
  const t = getTranslator();
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

  if (!profile) return <div>{t("profile.notFound")}</div>;

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
    // Include orphan agents (no directManager yet) so the manager's stats
    // mirror what they see on the dashboard.
    const team = await prisma.user.findMany({
      where: {
        role: "sales_agent",
        OR: [{ directManagerId: profile.id }, { directManagerId: null }],
      },
      select: { id: true },
    });
    const ids = [profile.id, ...team.map(u => u.id)];
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
    const team = await prisma.user.findMany({
      where: {
        role: "tele_sales_agent",
        OR: [{ directManagerId: profile.id }, { directManagerId: null }],
      },
      select: { id: true },
    });
    const ids = [profile.id, ...team.map(u => u.id)];
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
