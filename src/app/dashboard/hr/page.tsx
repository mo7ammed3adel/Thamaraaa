import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { buildHrOverview } from "@/lib/hrOverview";
import { computeSalaryReview } from "@/lib/salaryReview";
import HrClient from "./HrClient";
import HrAdminClient from "./HrAdminClient";

export default async function HrPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user) redirect("/login");

  const isManager = ["super_admin", "hr_manager"].includes(user.role);

  // ── HR Manager → new HR dashboard ──
  if (isManager) {
    const [employees, leaveRequests, salaryAdvances, complaints, departments] = await Promise.all([
      prisma.user.findMany({
        include: { hrRecord: true, directManager: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.leaveRequest.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.salaryAdvance.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.hrComplaint.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.hrDepartment.findMany({ orderBy: { name: "asc" } }),
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

    return (
      <HrAdminClient
        overview={overview}
        userName={user.name}
        employees={employees}
        departments={departments}
        leaveRequests={leaveRequests}
        salaryAdvances={salaryAdvances}
        complaints={complaints}
      />
    );
  }

  // ── Every other user → attendance + self-service (unchanged) ──
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [myAttendance, history, me] = await Promise.all([
    prisma.attendance.findFirst({ where: { userId: user.id, date: { gte: today } } }),
    prisma.attendance.findMany({ where: { userId: user.id }, orderBy: { date: "desc" }, take: 50 }),
    prisma.user.findUnique({
      where: { id: user.id },
      select: { hrRecord: { select: { currentSalary: true, baseSalary: true, hiringDate: true, department: true } } },
    }),
  ]);

  // Salary / evaluation / commission inherited from the employee's department.
  let salaryInfo: any = null;
  const hr = me?.hrRecord;
  if (hr) {
    let policy: any = {};
    if (hr.department) {
      const dep = await prisma.hrDepartment.findUnique({ where: { name: hr.department } });
      if (dep) { try { policy = JSON.parse(dep.policy); } catch { policy = {}; } }
    }
    const review = computeSalaryReview(hr.hiringDate, policy);
    salaryInfo = {
      currentSalary: hr.currentSalary ?? hr.baseSalary ?? 0,
      evaluationFrequency: review.evaluationFrequency,
      increaseType: review.increaseType,
      increaseValue: review.increaseValue,
      minEvalForIncrease: review.minEvalForIncrease,
      nextReviewDate: review.nextReviewDate ? review.nextReviewDate.toISOString() : null,
      daysUntilReview: review.daysUntilReview,
      nextEvaluationDate: review.nextEvaluationDate ? review.nextEvaluationDate.toISOString() : null,
      daysUntilEvaluation: review.daysUntilEvaluation,
      commission: { enabled: !!policy.commissionEnabled, type: policy.commissionType || "percentage", rules: policy.commissionRules || [] },
    };
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My HR Portal</h1>
      <HrClient myTodayAttendance={myAttendance} history={history} salaryInfo={salaryInfo} />
    </div>
  );
}
