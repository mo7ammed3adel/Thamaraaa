import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import SettingsClient from "./SettingsClient";
import { getTranslator } from "@/server/i18n/locale";

export default async function SettingsPage() {
  const t = getTranslator();
  const session = await getServerSession(authOptions);
  if ((session?.user as any)?.role !== "super_admin") {
    redirect("/dashboard");
  }

  const configs = await prisma.systemConfig.findMany();
  const commissions = await prisma.commissionRule.findMany();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t("settings.title")}</h1>
      <SettingsClient initialConfigs={configs} initialCommissions={commissions} />
    </div>
  );
}
