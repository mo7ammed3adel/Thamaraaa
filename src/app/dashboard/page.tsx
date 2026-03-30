import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DashboardHome() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;

  if (!user) redirect("/login");

  const role = user.role || "unknown";

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Welcome back, {session?.user?.name}</h1>
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-blue-900 mb-2">Role Information</h2>
        <p className="text-blue-800">
          You are logged in as a <span className="font-bold underline capitalize">{role.replace(/_/g, " ")}</span>.
          Use the sidebar to navigate to your specific modules.
        </p>
      </div>
    </div>
  );
}
