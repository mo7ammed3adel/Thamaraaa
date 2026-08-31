import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import TeleProgressClient from "./TeleProgressClient";
import { getTranslator } from "@/server/i18n/locale";

export default async function TeleProgressPage() {
  const t = getTranslator();
  const session = await getServerSession(authOptions);
  const user = session?.user as any;

  if (!["tele_sales_agent"].includes(user?.role)) {
    redirect("/dashboard");
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">{t("metric.myProgress")}</h1>
      <p className="text-sm text-gray-500 mb-6">
        Track your performance — calls, meetings, and lead outcomes with time filters.
      </p>
      <TeleProgressClient />
    </div>
  );
}
