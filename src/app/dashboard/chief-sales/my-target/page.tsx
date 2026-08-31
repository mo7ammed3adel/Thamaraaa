import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import MyTargetClient from "@/components/MyTargetClient";
import { authOptions } from "@/lib/auth";
import { getTranslator } from "@/server/i18n/locale";

export default async function ChiefSalesTargetPage() {
  const t = getTranslator();
  const session = await getServerSession(authOptions);
  const user = session?.user as any;

  if (user?.role !== "chief_sales") {
    redirect("/dashboard");
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">{t("metric.myTarget")}</h1>
      <p className="text-sm text-gray-500 mb-6">
        Your monthly fund target in SAR, measured from company-wide contracted sales revenue.
      </p>
      <MyTargetClient />
    </div>
  );
}
