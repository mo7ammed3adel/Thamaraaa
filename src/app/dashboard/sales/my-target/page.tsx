import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import MyTargetClient from "@/components/MyTargetClient";
import { authOptions } from "@/lib/auth";
import { getTranslator } from "@/server/i18n/locale";

export default async function SalesTargetPage() {
  const t = getTranslator();
  const session = await getServerSession(authOptions);
  const user = session?.user as any;

  if (!["sales_agent", "sales_manager"].includes(user?.role)) {
    redirect("/dashboard");
  }

  const description =
    user?.role === "sales_manager"
      ? "Your monthly fund target in SAR, measured from your team's contracted revenue plus your personal deals."
      : "Your monthly fund target in SAR, measured from your contracted deals.";

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">{t("metric.myTarget")}</h1>
      <p className="text-sm text-gray-500 mb-6">{description}</p>
      <MyTargetClient />
    </div>
  );
}
