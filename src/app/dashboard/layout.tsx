import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { User, Settings, PhoneCall, Briefcase, ListTodo, LogOut, Upload, RotateCcw, Users, BarChart3, Calendar, Handshake, TrendingUp, PlusSquare, Package } from "lucide-react";

import LogoutButton from "@/components/LogoutButton";
import NotificationBell from "@/components/NotificationBell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const role = (session.user as any).role;

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 text-slate-300 flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-slate-800 shrink-0">
          <span className="text-xl font-bold text-white tracking-wide">Thamaraa ERP</span>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          <Link href="/dashboard" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
            <span className="truncate">Dashboard Home</span>
          </Link>

          <NotificationBell variant="sidebar" />
          
          {role === "super_admin" && (
            <>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-6 mb-2 px-3">Administration</div>
              <Link href="/dashboard/users" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                <User className="mr-3 h-5 w-5 opacity-75" />
                Users
              </Link>
              <Link href="/dashboard/settings" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                <Settings className="mr-3 h-5 w-5 opacity-75" />
                System Config
              </Link>
            </>
          )}

          {(role === "tele_sales_agent" || role === "tele_sales_manager" || role === "super_admin") && (
            <>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-6 mb-2 px-3">Tele-Sales</div>
              <Link href="/dashboard/telesales" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                <PhoneCall className="mr-3 h-5 w-5 opacity-75" />
                Leads
              </Link>
              {(role === "super_admin" || role === "tele_sales_manager") && (
                <>
                  <Link href="/dashboard/leads-import" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                    <Upload className="mr-3 h-5 w-5 opacity-75" />
                    Upload Leads
                  </Link>
                  <Link href="/dashboard/telesales/cold-leads" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                    <PlusSquare className="mr-3 h-5 w-5 opacity-75" />
                    Add Cold Leads
                  </Link>
                  <Link href="/dashboard/telesales/my-team" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                    <Users className="mr-3 h-5 w-5 opacity-75" />
                    My Team
                  </Link>
                  <Link href="/dashboard/telesales/analytics" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                    <BarChart3 className="mr-3 h-5 w-5 opacity-75" />
                    Team Analytics
                  </Link>
                  <Link href="/dashboard/telesales/recycle" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                    <RotateCcw className="mr-3 h-5 w-5 opacity-75" />
                    Recycle Hot Leads
                  </Link>
                </>
              )}
              {role === "tele_sales_agent" && (
                <>
                  <Link href="/dashboard/telesales/meets" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                    <Calendar className="mr-3 h-5 w-5 opacity-75" />
                    Meets
                  </Link>
                  <Link href="/dashboard/telesales/my-progress" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                    <TrendingUp className="mr-3 h-5 w-5 opacity-75" />
                    My Progress
                  </Link>
                  <Link href="/dashboard/telesales/cold-leads" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                    <PlusSquare className="mr-3 h-5 w-5 opacity-75" />
                    Add Cold Leads
                  </Link>
                </>
              )}
            </>
          )}

          {/* Deals - visible to tele_sales + sales roles */}
          {(role === "tele_sales_agent" || role === "tele_sales_manager" || role === "sales_agent" || role === "sales_manager" || role === "super_admin") && (
            <>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-6 mb-2 px-3">Deals</div>
              <Link href="/dashboard/deals" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                <Handshake className="mr-3 h-5 w-5 opacity-75" />
                Deals
              </Link>
            </>
          )}

          {(role === "sales_agent" || role === "sales_manager" || role === "super_admin") && (
            <>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-6 mb-2 px-3">Sales</div>
              <Link href="/dashboard/sales" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                <Briefcase className="mr-3 h-5 w-5 opacity-75" />
                Opportunities
              </Link>
              {(role === "super_admin" || role === "sales_manager") && (
                <>
                  <Link href="/dashboard/sales/my-team" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                    <Users className="mr-3 h-5 w-5 opacity-75" />
                    My Team
                  </Link>
                  <Link href="/dashboard/sales/analytics" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                    <BarChart3 className="mr-3 h-5 w-5 opacity-75" />
                    Team Analytics
                  </Link>
                  <Link href="/dashboard/sales/recycle-bin" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                    <RotateCcw className="mr-3 h-5 w-5 opacity-75" />
                    Recycle Bin
                  </Link>
                </>
              )}
              {role === "sales_agent" && (
                <Link href="/dashboard/sales/my-progress" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                  <TrendingUp className="mr-3 h-5 w-5 opacity-75" />
                  My Progress
                </Link>
              )}
            </>
          )}

          {(role === "operations_agent" || role === "account_manager" || role === "team_leader" || role === "super_admin") && (
            <>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-6 mb-2 px-3">Operations</div>
              <Link href="/dashboard/operations" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                <ListTodo className="mr-3 h-5 w-5 opacity-75" />
                Projects & Tasks
              </Link>
              <Link href="/dashboard/operations/packages" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                <Package className="mr-3 h-5 w-5 opacity-75" />
                Packages & Settings
              </Link>
            </>
          )}

          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-6 mb-2 px-3">HR & Finance</div>
          <Link href="/dashboard/hr" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
            <User className="mr-3 h-5 w-5 opacity-75" />
            Attendance
          </Link>
          {(role === "super_admin" || role === "hr_manager") && (
            <Link href="/dashboard/hr/hiring" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
              <Users className="mr-3 h-5 w-5 opacity-75" />
              Hiring Pipeline
            </Link>
          )}
          {(role === "super_admin" || role === "hr_manager" || role === "sales_agent" || role === "sales_manager") && (
            <Link href="/dashboard/finance" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
              <Briefcase className="mr-3 h-5 w-5 opacity-75" />
              Payroll & Commission
            </Link>
          )}

          {role === "super_admin" && (
            <Link href="/dashboard/master-sheet" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors mt-2">
              <ListTodo className="mr-3 h-5 w-5 opacity-75" />
              Global Master Sheet
            </Link>
          )}

          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-6 mb-2 px-3">Personal</div>
          <Link href="/dashboard/profile" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
            <User className="mr-3 h-5 w-5 opacity-75" />
            My Profile
          </Link>
        </nav>
        
        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center mb-4">
            <div className="ml-3">
              <p className="text-sm font-medium text-white">{session.user?.name}</p>
              <p className="text-xs font-medium text-slate-400 capitalize">{role.replace(/_/g, " ")}</p>
            </div>
          </div>
          <LogoutButton />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-white">
        {/* Header for main content */}
        <div className="h-16 flex items-center justify-end px-6 border-b border-gray-200 shrink-0">
          <div className="ml-4 flex items-center md:ml-6 gap-3">
            <NotificationBell />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
