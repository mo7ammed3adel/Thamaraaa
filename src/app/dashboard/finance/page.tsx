import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import FinanceClient from "./FinanceClient";
import { getTranslator } from "@/server/i18n/locale";

export default async function FinancePage() {
  const t = getTranslator();
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  
  if (!user || (!["super_admin", "accountant"].includes(user.role))) {
    redirect("/dashboard");
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t("finance.dashboardTitle")}</h1>
      <FinanceClient />
    </div>
  );
}
