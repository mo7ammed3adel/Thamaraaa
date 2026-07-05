import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import MyTargetClient from "@/components/MyTargetClient";

export default async function SalesTargetPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;

  if (!["sales_agent"].includes(user?.role)) {
    redirect("/dashboard");
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">My Target</h1>
      <p className="text-sm text-gray-500 mb-6">
        Your monthly target set by your manager — track how many deals you closed each month.
      </p>
      <MyTargetClient />
    </div>
  );
}
