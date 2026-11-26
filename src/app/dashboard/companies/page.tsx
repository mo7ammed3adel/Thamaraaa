import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import CompaniesClient from "./CompaniesClient";
import { getTranslator } from "@/server/i18n/locale";

export default async function CompaniesPage() {
  const t = getTranslator();
  const session = await getServerSession(authOptions);
  if (!["super_admin", "general_manager"].includes((session?.user as any)?.role)) {
    redirect("/dashboard");
  }

  const companies = await prisma.company.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { users: true, leads: true } } },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t("companies.title")}</h1>
      <CompaniesClient initialCompanies={companies} />
    </div>
  );
}
