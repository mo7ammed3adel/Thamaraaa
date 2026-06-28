import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { User, Settings, PhoneCall, Briefcase, ListTodo, LogOut, Upload, RotateCcw, Users, BarChart3, Calendar, Handshake, TrendingUp, PlusSquare, Package, AlertTriangle, Crown, Shield, Monitor, Search, Megaphone, ShoppingCart, Palette, Film, Layout, DollarSign, ClipboardList } from "lucide-react";

import LogoutButton from "@/components/LogoutButton";
import NotificationBell from "@/components/NotificationBell";
import WarningPopup from "@/components/WarningPopup";
import GlobalWarningAlert from "@/components/GlobalWarningAlert";
import DashboardShell from "@/components/DashboardShell";
import ImpersonationBanner from "@/components/ImpersonationBanner";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const role = session.user.role;
  const userId = session.user.id;
  const impersonatedBy = session.user.impersonatedBy;

  /** Check if user has one of the given roles (super_admin always passes) */
  const hasRole = (...roles: string[]) => roles.includes(role) || role === "super_admin";

  return (
    <>
      {impersonatedBy && <ImpersonationBanner name={session.user.name} role={role} />}

      {/* Warning Popup - renders for all roles, filters internally */}
      <WarningPopup userRole={role} userId={userId} />
      <GlobalWarningAlert userId={userId} />

      <DashboardShell
        headerActions={<NotificationBell />}
        footer={
          <div className="p-4 border-t border-slate-800">
            <div className="flex items-center mb-4">
              <div className="ml-3">
                <p className="text-sm font-medium text-white">{session.user?.name}</p>
                <p className="text-xs font-medium text-slate-400 capitalize">{role.replace(/_/g, " ")}</p>
              </div>
            </div>
            <LogoutButton />
          </div>
        }
        nav={
          <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          <Link href="/dashboard" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
            <span className="truncate">Dashboard Home</span>
          </Link>

          <NotificationBell variant="sidebar" />
          
          {/* ===== ADMINISTRATION ===== */}
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

          {/* ===== CHIEF SALES ===== */}
          {hasRole("chief_sales") && (
            <>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-6 mb-2 px-3">Executive Sales</div>
              <Link href="/dashboard/chief-sales" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                <Crown className="mr-3 h-5 w-5 opacity-75" />
                Sales Overview
              </Link>
              <Link href="/dashboard/chief-sales/pipeline" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                <TrendingUp className="mr-3 h-5 w-5 opacity-75" />
                Pipeline
              </Link>
            </>
          )}

          {/* ===== TELE-SALES ===== */}
          {hasRole("tele_sales_agent", "tele_sales_manager") && (
            <>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-6 mb-2 px-3">Tele-Sales</div>
              <Link href="/dashboard/telesales" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                <PhoneCall className="mr-3 h-5 w-5 opacity-75" />
                Leads
              </Link>
              {hasRole("tele_sales_manager") && (
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

          {/* ===== DEALS ===== */}
          {hasRole("tele_sales_agent", "tele_sales_manager", "sales_agent", "sales_manager", "chief_sales") && (
            <>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-6 mb-2 px-3">Deals</div>
              <Link href="/dashboard/deals" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                <Handshake className="mr-3 h-5 w-5 opacity-75" />
                Deals
              </Link>
            </>
          )}

          {/* ===== SALES ===== */}
          {hasRole("sales_agent", "sales_manager") && (
            <>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-6 mb-2 px-3">Sales</div>
              <Link href="/dashboard/sales" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                <Briefcase className="mr-3 h-5 w-5 opacity-75" />
                Opportunities
              </Link>
              {hasRole("sales_manager") && (
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

          {/* ===== ACCOUNT MANAGEMENT ===== */}
          {hasRole("head_account_manager", "account_manager") && (
            <>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-6 mb-2 px-3">Account Management</div>
              {hasRole("head_account_manager") && (
                <Link href="/dashboard/head-account-manager" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                  <Shield className="mr-3 h-5 w-5 opacity-75" />
                  All Projects
                </Link>
              )}
              {hasRole("account_manager") && (
                <Link href="/dashboard/account-manager" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                  <Briefcase className="mr-3 h-5 w-5 opacity-75" />
                  My Clients
                </Link>
              )}
              <Link href="/dashboard/operations" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                <ListTodo className="mr-3 h-5 w-5 opacity-75" />
                Projects & Tasks
              </Link>
              {hasRole("head_account_manager") && (
                <Link href="/dashboard/operations/packages" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                  <Package className="mr-3 h-5 w-5 opacity-75" />
                  Packages & Settings
                </Link>
              )}
            </>
          )}

          {/* ===== HEAD TECHNICAL ===== */}
          {hasRole("head_technical") && (
            <>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-6 mb-2 px-3">Technical</div>
              <Link href="/dashboard/head-technical" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                <Monitor className="mr-3 h-5 w-5 opacity-75" />
                Technical Overview
              </Link>
              <Link href="/dashboard/operations" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                <ClipboardList className="mr-3 h-5 w-5 opacity-75" />
                All Client Projects
              </Link>
            </>
          )}

          {/* ===== SEO TEAM ===== */}
          {hasRole("head_seo", "team_leader_seo", "agent_seo", "agent_content_seo") && (
            <>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-6 mb-2 px-3">SEO</div>
              <Link href="/dashboard/seo" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                <Search className="mr-3 h-5 w-5 opacity-75" />
                {hasRole("head_seo", "team_leader_seo") ? "SEO Projects" : "My Tasks"}
              </Link>
            </>
          )}

          {/* ===== SOCIAL MEDIA TEAM ===== */}
          {hasRole("team_leader_social_media", "agent_social_media") && (
            <>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-6 mb-2 px-3">Social Media</div>
              <Link href="/dashboard/social-media" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                <Megaphone className="mr-3 h-5 w-5 opacity-75" />
                {hasRole("team_leader_social_media") ? "Social Projects" : "My Tasks"}
              </Link>
            </>
          )}

          {/* ===== MEDIA BUYER TEAM ===== */}
          {hasRole("team_leader_media_buyer", "agent_media_buyer") && (
            <>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-6 mb-2 px-3">Media Buying</div>
              <Link href="/dashboard/media-buyer" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                <ShoppingCart className="mr-3 h-5 w-5 opacity-75" />
                {hasRole("team_leader_media_buyer") ? "Campaigns" : "My Tasks"}
              </Link>
            </>
          )}

          {/* ===== DESIGN TEAMS ===== */}
          {hasRole("leader_graphic_designer", "agent_graphic_designer", "leader_motion_graphic", "agent_motion_graphic", "leader_ui", "agent_ui") && (
            <>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-6 mb-2 px-3">Design & Creative</div>
              {hasRole("leader_graphic_designer", "agent_graphic_designer") && (
                <Link href="/dashboard/design?team=graphic" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                  <Palette className="mr-3 h-5 w-5 opacity-75" />
                  Graphic Design
                </Link>
              )}
              {hasRole("leader_motion_graphic", "agent_motion_graphic") && (
                <Link href="/dashboard/design?team=motion" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                  <Film className="mr-3 h-5 w-5 opacity-75" />
                  Motion Graphics
                </Link>
              )}
              {hasRole("leader_ui", "agent_ui") && (
                <Link href="/dashboard/design?team=ui" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                  <Layout className="mr-3 h-5 w-5 opacity-75" />
                  UI/UX Design
                </Link>
              )}
            </>
          )}

          {/* ===== LEGACY OPERATIONS (team_leader / operations_agent) ===== */}
          {(role === "team_leader" || role === "operations_agent") && (
            <>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-6 mb-2 px-3">Operations</div>
              <Link href="/dashboard/operations" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                <ListTodo className="mr-3 h-5 w-5 opacity-75" />
                Projects & Tasks
              </Link>
            </>
          )}

          {/* ===== HR & FINANCE ===== */}
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-6 mb-2 px-3">HR & Finance</div>
          {/* Attendance visible to everyone */}
          <Link href="/dashboard/hr" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
            <User className="mr-3 h-5 w-5 opacity-75" />
            Attendance
          </Link>
          {/* HR Management: only for hr_manager (+ super_admin via hasRole) */}
          {hasRole("hr_manager") && (
            <Link href="/dashboard/hr" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
              <Users className="mr-3 h-5 w-5 opacity-75" />
              Employee Directory
            </Link>
          )}
          {/* Finance: only for accountant (+ super_admin via hasRole) */}
          {hasRole("accountant") && (
            <Link href="/dashboard/finance" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
              <DollarSign className="mr-3 h-5 w-5 opacity-75" />
              Finance Dashboard
            </Link>
          )}

          {/* ===== WARNINGS CENTER ===== */}
          {hasRole("chief_sales", "head_account_manager", "account_manager", "head_technical", "head_seo", "sales_manager", "team_leader_seo", "team_leader_social_media", "team_leader_media_buyer", "leader_graphic_designer", "leader_motion_graphic", "leader_ui", "agent_seo", "agent_content_seo", "agent_social_media", "agent_media_buyer", "agent_graphic_designer", "agent_motion_graphic", "agent_ui") && (
            <>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-6 mb-2 px-3">Communication</div>
              <Link href="/dashboard/warnings" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                <AlertTriangle className="mr-3 h-5 w-5 opacity-75" />
                Warnings Center
              </Link>
            </>
          )}

          {role === "super_admin" && (
            <Link href="/dashboard/master-sheet" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors mt-2">
              <ClipboardList className="mr-3 h-5 w-5 opacity-75" />
              Global Master Sheet
            </Link>
          )}

          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-6 mb-2 px-3">Personal</div>
          <Link href="/dashboard/profile" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
            <User className="mr-3 h-5 w-5 opacity-75" />
            My Profile
          </Link>
          </nav>
        }
      >
        {children}
      </DashboardShell>
    </>
  );
}
