import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import UserListClient from "./UserListClient";

export default async function UsersPage() {
  const session = await getServerSession(authOptions);
  
  if ((session?.user as any)?.role !== "super_admin" && (session?.user as any)?.role !== "hr_manager") {
    redirect("/dashboard");
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      level: true,
      status: true,
      company: true,
      createdAt: true,
      directManagerId: true,
      directManager: { select: { id: true, name: true } },
    }
  });

  // Fetch managers for assignment
  const managers = await prisma.user.findMany({
    where: {
      role: { in: ["tele_sales_manager", "sales_manager", "head_account_manager", "head_technical", "head_seo", "leader_ui"] },
      status: "Active"
    },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" }
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
      </div>
      <UserListClient initialUsers={users} managers={managers} />
    </div>
  );
}
