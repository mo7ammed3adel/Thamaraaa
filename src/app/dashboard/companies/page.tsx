import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import CompaniesClient from "./CompaniesClient";

export default async function CompaniesPage() {
  const session = await getServerSession(authOptions);
  if ((session?.user as any)?.role !== "super_admin") {
    redirect("/dashboard");
  }

  const companies = await prisma.company.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { users: true, leads: true } } },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Companies</h1>
      <CompaniesClient initialCompanies={companies} />
    </div>
  );
}
