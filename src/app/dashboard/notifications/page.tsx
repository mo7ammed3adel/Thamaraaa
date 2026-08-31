import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import NotificationsClient from "./NotificationsClient";
import { getTranslator } from "@/server/i18n/locale";

export default async function NotificationsPage() {
  const t = getTranslator();
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t("common.notifications")}</h1>
      </div>
      <NotificationsClient />
    </div>
  );
}
