import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { buildHrOverview } from "@/lib/hrOverview";
import HrClient from "./HrClient";
import HrAdminClient from "./HrAdminClient";

export default async function HrPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user) redirect("/login");

  const isManager = ["super_admin", "hr_manager"].includes(user.role);

  // ── HR Manager → new HR dashboard ──
  if (isManager) {
    const [employees, leaveRequests, salaryAdvances] = await Promise.all([
      prisma.user.findMany({
        include: { hrRecord: { select: { documentChecklist: true, dateOfBirth: true, gender: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.leaveRequest.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.salaryAdvance.findMany({ select: { status: true } }),
    ]);

    const overview = buildHrOverview(
      employees.map((e) => ({
        id: e.id,
        name: e.name,
        role: e.role,
        status: e.status,
        createdAt: e.createdAt,
        hrRecord: e.hrRecord,
      })),
      leaveRequests,
      salaryAdvances
    );

    return <HrAdminClient overview={overview} userName={user.name} />;
  }

  // ── Every other user → attendance + self-service (unchanged) ──
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [myAttendance, history] = await Promise.all([
    prisma.attendance.findFirst({ where: { userId: user.id, date: { gte: today } } }),
    prisma.attendance.findMany({ where: { userId: user.id }, orderBy: { date: "desc" }, take: 50 }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Attendance</h1>
      <HrClient myTodayAttendance={myAttendance} history={history} />
    </div>
  );
}
