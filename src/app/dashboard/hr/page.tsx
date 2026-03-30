import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import HrClient from "./HrClient";

export default async function HrPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user) redirect("/login");

  // Determine if manager
  const isManager = ["super_admin", "hr_manager"].includes(user.role);

  // Fetch today's attendance for the user
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const myAttendance = await prisma.attendance.findFirst({
    where: {
      userId: user.id,
      date: { gte: today }
    }
  });

  // Fetch all attendance for table (if manager, show all; otherwise just user's)
  const allAttendance = await prisma.attendance.findMany({
    where: isManager ? {} : { userId: user.id },
    include: { user: { select: { name: true, role: true } } },
    orderBy: { date: "desc" },
    take: 50
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">HR & Attendance Hub</h1>
      <HrClient 
        isManager={isManager}
        myTodayAttendance={myAttendance}
        history={allAttendance}
      />
    </div>
  );
}
