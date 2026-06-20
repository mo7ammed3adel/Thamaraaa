import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import PackagesClient from "./PackagesClient";

/**
 * Server-side page component for the Packages & Settings route.
 * Verifies user authorization before rendering the client component.
 */
export default async function PackagesPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;

  if (
    !["super_admin", "head_account_manager"].includes(
      user?.role
    )
  ) {
    redirect("/dashboard");
  }

  return <PackagesClient />;
}
