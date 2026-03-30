import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function FinancePage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user) redirect("/login");

  const isFinanceAdmin = ["super_admin", "hr_manager"].includes(user.role); // Treating hr_manager/admin as finance for now

  // Fetch sales deals to calculate current month commissions
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const deals = await prisma.deal.findMany({
    where: isFinanceAdmin ? { createdAt: { gte: startOfMonth } } : { salesAgentId: user.id, createdAt: { gte: startOfMonth } },
    include: { salesAgent: { select: { name: true, level: true, role: true } } },
    orderBy: { createdAt: "desc" }
  });

  // Calculate generic 5% commission for demonstration based on Net Target
  const dealsWithCommissions = deals.map(d => ({
    ...d,
    commissionAmount: d.netTarget * 0.05
  }));

  const totalCommission = dealsWithCommissions.reduce((sum, d) => sum + d.commissionAmount, 0);
  const totalNetRevenue = dealsWithCommissions.reduce((sum, d) => sum + d.netTarget, 0);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Finance & Payroll Dashboard (This Month)</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-1">Total Net Revenue</h3>
          <p className="text-3xl font-bold text-green-600">SAR {totalNetRevenue.toFixed(2)}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-1">Total Commissions Earned</h3>
          <p className="text-3xl font-bold text-blue-600">SAR {totalCommission.toFixed(2)}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {isFinanceAdmin && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Agent</th>}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Package</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gross Payment</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Net Target</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Commission (5%)</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {dealsWithCommissions.map((d: any) => (
              <tr key={d.id}>
                {isFinanceAdmin && <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{d.salesAgent.name}</td>}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{d.package}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">SAR {d.totalAmount}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">SAR {d.netTarget}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-blue-600">SAR {d.commissionAmount.toFixed(2)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(d.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
            {deals.length === 0 && (
              <tr><td colSpan={isFinanceAdmin ? 6 : 5} className="px-6 py-8 text-center text-gray-500">No deals closed this month yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
