import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import ChiefSalesClient from "./ChiefSalesClient";

export default async function ChiefSalesPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;

  if (!["super_admin", "chief_sales"].includes(user?.role)) {
    redirect("/dashboard");
  }

  return (
    <div>
      <ChiefSalesClient />
    </div>
  );
}
