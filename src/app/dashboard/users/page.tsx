import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DIRECT_MANAGER_ROLES } from "@/lib/constants";
import UserListClient from "./UserListClient";

export default async function UsersPage() {
  const session = await getServerSession(authOptions);
  
  const viewerRole = (session?.user as any)?.role;
  if (viewerRole !== "super_admin" && viewerRole !== "hr_manager") {
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
      companyId: true,
      companyRef: { select: { id: true, name: true } },
      createdAt: true,
      directManagerId: true,
      directManager: { select: { id: true, name: true } },
    }
  });

  // Fetch managers for assignment
  const managers = await prisma.user.findMany({
    where: {
      role: { in: [...DIRECT_MANAGER_ROLES] },
      status: "Active"
    },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" }
  });

  const companies = await prisma.company.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
      </div>
      <UserListClient initialUsers={users} managers={managers} companies={companies} canImpersonate={viewerRole === "super_admin"} canDelete={viewerRole === "super_admin"} />
    </div>
  );
}
