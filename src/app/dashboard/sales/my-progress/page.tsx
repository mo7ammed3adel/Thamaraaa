import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import SalesProgressClient from "./SalesProgressClient";
import { getTranslator } from "@/server/i18n/locale";

export default async function SalesProgressPage() {
  const t = getTranslator();
  const session = await getServerSession(authOptions);
  const user = session?.user as any;

  if (!["sales_agent"].includes(user?.role)) {
    redirect("/dashboard");
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">{t("metric.myProgress")}</h1>
      <p className="text-sm text-gray-500 mb-6">
        Track your sales performance — leads, meetings, deals, and revenue with time filters.
      </p>
      <SalesProgressClient />
    </div>
  );
}
