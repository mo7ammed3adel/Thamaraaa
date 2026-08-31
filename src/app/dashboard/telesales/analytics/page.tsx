import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import TeamAnalyticsClient from "./TeamAnalyticsClient";
import { getTranslator } from "@/server/i18n/locale";

export default async function TeamAnalyticsPage() {
  const t = getTranslator();
  const session = await getServerSession(authOptions);
  const user = session?.user as any;

  if (!["super_admin", "tele_sales_manager"].includes(user?.role)) {
    redirect("/dashboard");
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">{t("nav.teamAnalytics")}</h1>
      <p className="text-sm text-gray-500 mb-6">
        Monitor your team's performance — calls, meetings, deals, and revenue with customizable date filters.
      </p>
      <TeamAnalyticsClient />
    </div>
  );
}
