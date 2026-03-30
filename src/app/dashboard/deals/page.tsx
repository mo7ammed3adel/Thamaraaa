import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import DealsClient from "./DealsClient";

export default async function DealsPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;

  if (!["super_admin", "tele_sales_manager", "tele_sales_agent", "sales_manager", "sales_agent"].includes(user?.role)) {
    redirect("/dashboard");
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Deals</h1>
      <p className="text-sm text-gray-500 mb-6">
        All clients who closed deals — click on any client to view their full journey.
      </p>
      <DealsClient userRole={user.role} />
    </div>
  );
}
