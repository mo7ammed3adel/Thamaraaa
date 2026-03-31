import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import SalesTeamAnalyticsClient from "./SalesTeamAnalyticsClient";

export default async function SalesTeamAnalyticsPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;

  if (!["super_admin", "sales_manager"].includes(user?.role)) {
    redirect("/dashboard");
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Sales Team Analytics</h1>
      <p className="text-sm text-gray-500 mb-6">
        Monitor your sales team performance — leads, meetings, deals, and revenue with date filters.
      </p>
      <SalesTeamAnalyticsClient />
    </div>
  );
}
