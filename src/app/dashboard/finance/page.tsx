import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import FinanceClient from "./FinanceClient";

export default async function FinancePage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  
  if (!user || (!["super_admin", "accountant"].includes(user.role))) {
    redirect("/dashboard");
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Finance & Payroll Dashboard</h1>
      <FinanceClient />
    </div>
  );
}
