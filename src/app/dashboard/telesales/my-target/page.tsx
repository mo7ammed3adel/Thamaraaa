import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import MyTargetClient from "@/components/MyTargetClient";
import { authOptions } from "@/lib/auth";
import { getTranslator } from "@/server/i18n/locale";

export default async function TeleTargetPage() {
  const t = getTranslator();
  const session = await getServerSession(authOptions);
  const user = session?.user as any;

  if (!["tele_sales_agent", "tele_sales_manager"].includes(user?.role)) {
    redirect("/dashboard");
  }

  const description =
    user?.role === "tele_sales_manager"
      ? "Your monthly target is actual meetings attended by your tele-sales team."
      : "Your monthly target is your actual meetings attended by clients.";

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">{t("metric.myTarget")}</h1>
      <p className="text-sm text-gray-500 mb-6">{description}</p>
      <MyTargetClient />
    </div>
  );
}
