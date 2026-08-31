import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ClientAssignClient from "./ClientAssignClient";
import { getTranslator } from "@/server/i18n/locale";

/**
 * Super-admin "Client Assign" workspace: every client/project and which Head
 * Account Manager (if any) it belongs to, so the super-admin can distribute
 * incoming clients. A client only appears in a Head AM's workspace once it is
 * assigned here.
 */
export default async function ClientAssignPage() {
  const t = getTranslator();
  const session = await getServerSession(authOptions);
  const user = session?.user;

  if (!user || user.role !== "super_admin") {
    redirect("/dashboard");
  }

  const projects = await prisma.project.findMany({
    include: {
      deal: { select: { lead: { select: { name: true, phone: true } } } },
      headAccountManager: { select: { id: true, name: true } },
      accountManager: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const headAccountManagers = await prisma.user.findMany({
    where: { role: "head_account_manager", status: "Active" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const clients = projects.map((p) => ({
    id: p.id,
    name: p.deal?.lead?.name || "Unnamed client",
    phone: p.deal?.lead?.phone || null,
    package: p.package,
    createdAt: p.createdAt.toISOString(),
    headAccountManagerId: p.headAccountManagerId,
    headAccountManagerName: p.headAccountManager?.name || null,
    accountManagerName: p.accountManager?.name || null,
  }));

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">{t("assign.title")}</h1>
      <p className="text-sm text-gray-500 mb-6">{t("assign.subtitle")}</p>
      <ClientAssignClient clients={clients} headAccountManagers={headAccountManagers} />
    </div>
  );
}
