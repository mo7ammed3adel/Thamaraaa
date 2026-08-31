import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import SuperAdminClient from "./SuperAdminClient";
import { getTranslator } from "@/server/i18n/locale";

function startOf(range: "today" | "week" | "month"): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (range === "week") {
    const day = d.getDay();
    d.setDate(d.getDate() - day); // start of week (Sunday)
  } else if (range === "month") {
    d.setDate(1);
  }
  return d;
}

async function rangeStats(gte?: Date) {
  const where = gte ? { createdAt: { gte } } : {};
  const dealWhere: any = { status: "Closed_Won", ...(gte ? { createdAt: { gte } } : {}) };
  const [leads, projects, deals] = await Promise.all([
    prisma.lead.count({ where }),
    prisma.project.count({ where }),
    prisma.deal.findMany({ where: dealWhere, select: { totalAmount: true } }),
  ]);
  const revenue = deals.reduce((sum, d) => sum + (d.totalAmount || 0), 0);
  return { leads, projects, deals: deals.length, revenue };
}

export default async function DashboardHome() {
  const t = getTranslator();
  const session = await getServerSession(authOptions);
  const user = session?.user as any;

  if (!user) redirect("/login");

  const role = user.role || "unknown";

  if (role === "super_admin") {
    const [today, week, month, all, activeEmployees, activeWarnings] = await Promise.all([
      rangeStats(startOf("today")),
      rangeStats(startOf("week")),
      rangeStats(startOf("month")),
      rangeStats(),
      prisma.user.count({ where: { status: "Active" } }),
      prisma.warning.count({ where: { status: { not: "Resolved" } } }),
    ]);

    return (
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-6">{t("dashboard.commandCentre")}</h1>
        <SuperAdminClient
          stats={{ today, week, month, all }}
          activeEmployees={activeEmployees}
          activeWarnings={activeWarnings}
        />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Welcome back, {session?.user?.name}</h1>
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-blue-900 mb-2">{t("dashboard.roleInfo")}</h2>
        <p className="text-blue-800">
          You are logged in as a <span className="font-bold underline capitalize">{role.replace(/_/g, " ")}</span>.
          Use the sidebar to navigate to your specific modules.
        </p>
      </div>
    </div>
  );
}
