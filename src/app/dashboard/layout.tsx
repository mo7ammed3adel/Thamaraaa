import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { User, Settings, PhoneCall, Briefcase, ListTodo, LogOut, Upload, RotateCcw, Users, BarChart3, Calendar, Handshake, TrendingUp, PlusSquare, Package, AlertTriangle, Crown, Shield, Monitor, Search, Megaphone, ShoppingCart, Palette, Film, Layout, DollarSign, ClipboardList, Building2, UserCheck, Target } from "lucide-react";

import LogoutButton from "@/components/LogoutButton";
import AutoRefresher from "@/components/AutoRefresher";
import RealtimeRefresher from "@/components/RealtimeRefresher";
import NotificationBell from "@/components/NotificationBell";
import WarningPopup from "@/components/WarningPopup";
import GlobalWarningAlert from "@/components/GlobalWarningAlert";
import DashboardShell from "@/components/DashboardShell";
import LanguageSwitcher from "@/components/i18n/LanguageSwitcher";
import { getTranslator } from "@/server/i18n/locale";
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

  // First-login gate: auto-provisioned employees must set their own password
  // before they can use the app. Impersonating super-admins are exempt.
  if (session.user.mustChangePassword && !session.user.impersonatedBy) {
    redirect("/change-password");
  }

  const t = getTranslator();
  const role = session.user.role;
  const userId = session.user.id;
  const impersonatedBy = session.user.impersonatedBy;

  /** Check if user has one of the given roles (super_admin always passes) */
  const hasRole = (...roles: string[]) => roles.includes(role) || role === "super_admin";

  return (
    <>
      {/* Live data: Pusher pushes changes instantly when configured; the poller
          is the fallback (fast when there's no Pusher, gentle safety-net when
          real-time is handling immediacy). */}
      <RealtimeRefresher />
      <AutoRefresher intervalMs={process.env.NEXT_PUBLIC_PUSHER_KEY ? 30000 : 8000} />

      {impersonatedBy && <ImpersonationBanner name={session.user.name} role={role} />}

      {/* Warning Popup - renders for all roles, filters internally */}
      <WarningPopup userRole={role} userId={userId} />
      <GlobalWarningAlert userId={userId} />

      <DashboardShell
        headerActions={
          <>
            <LanguageSwitcher />
            <NotificationBell />
          </>
        }
        footer={
          <div className="p-4 border-t border-slate-800">
            <div className="flex items-center mb-4">
              <div className="ms-3">
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
            <span className="truncate">{t("nav.home")}</span>
          </Link>

          <NotificationBell variant="sidebar" />
          
          {/* ===== ADMINISTRATION ===== */}
          {role === "super_admin" && (
            <>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-6 mb-2 px-3">{t("nav.section.administration")}</div>
              <Link href="/dashboard/users" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                <User className="me-3 h-5 w-5 opacity-75" />
                {t("nav.users")}
              </Link>
              <Link href="/dashboard/companies" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                <Building2 className="me-3 h-5 w-5 opacity-75" />
                {t("nav.companies")}
              </Link>
              <Link href="/dashboard/client-assign" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                <UserCheck className="me-3 h-5 w-5 opacity-75" />
                {t("nav.clientAssign")}
              </Link>
              <Link href="/dashboard/settings" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                <Settings className="me-3 h-5 w-5 opacity-75" />
                {t("nav.systemConfig")}
              </Link>
              <Link href="/dashboard/monitoring" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                <Monitor className="mr-3 h-5 w-5 opacity-75" />
                {t("nav.monitoring")}
              </Link>
            </>
          )}

          {/* ===== CHIEF SALES ===== */}
          {hasRole("chief_sales") && (
            <>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-6 mb-2 px-3">{t("nav.section.executiveSales")}</div>
              <Link href="/dashboard/chief-sales" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                <Crown className="me-3 h-5 w-5 opacity-75" />
                {t("nav.salesOverview")}
              </Link>
              <Link href="/dashboard/chief-sales/pipeline" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                <TrendingUp className="me-3 h-5 w-5 opacity-75" />
                {t("nav.pipeline")}
              </Link>
              <Link href="/dashboard/chief-sales/sales-managers" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                <Users className="me-3 h-5 w-5 opacity-75" />
                {t("nav.salesManagers")}
              </Link>
              {role === "chief_sales" && (
                <Link href="/dashboard/chief-sales/my-target" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                  <Target className="me-3 h-5 w-5 opacity-75" />
                  {t("nav.myTarget")}
                </Link>
              )}
            </>
          )}

          {/* ===== TELE-SALES ===== */}
          {hasRole("tele_sales_agent", "tele_sales_manager") && (
            <>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-6 mb-2 px-3">{t("nav.section.teleSales")}</div>
              <Link href="/dashboard/telesales" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                <PhoneCall className="me-3 h-5 w-5 opacity-75" />
                {t("nav.leads")}
              </Link>
              <Link href="/dashboard/leads-import" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                <Upload className="me-3 h-5 w-5 opacity-75" />
                {t("nav.uploadLeads")}
              </Link>
              {hasRole("tele_sales_manager") && (
                <>
                  <Link href="/dashboard/telesales/cold-leads" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                    <PlusSquare className="me-3 h-5 w-5 opacity-75" />
                    {t("nav.addColdLeads")}
                  </Link>
                  <Link href="/dashboard/telesales/my-team" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                    <Users className="me-3 h-5 w-5 opacity-75" />
                    {t("nav.myTeam")}
                  </Link>
                  <Link href="/dashboard/telesales/analytics" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                    <BarChart3 className="me-3 h-5 w-5 opacity-75" />
                    {t("nav.teamAnalytics")}
                  </Link>
                  {role === "tele_sales_manager" && (
                    <Link href="/dashboard/telesales/my-target" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                      <Target className="me-3 h-5 w-5 opacity-75" />
                      {t("nav.myTarget")}
                    </Link>
                  )}
                  <Link href="/dashboard/telesales/recycle" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                    <RotateCcw className="me-3 h-5 w-5 opacity-75" />
                    {t("nav.recycleHotLeads")}
                  </Link>
                </>
              )}
              {role === "tele_sales_agent" && (
                <>
                  <Link href="/dashboard/telesales/meets" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                    <Calendar className="me-3 h-5 w-5 opacity-75" />
                    {t("nav.meets")}
                  </Link>
                  <Link href="/dashboard/telesales/my-progress" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                    <TrendingUp className="me-3 h-5 w-5 opacity-75" />
                    {t("nav.myProgress")}
                  </Link>
                  <Link href="/dashboard/telesales/my-target" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                    <Target className="me-3 h-5 w-5 opacity-75" />
                    {t("nav.myTarget")}
                  </Link>
                  <Link href="/dashboard/telesales/cold-leads" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                    <PlusSquare className="me-3 h-5 w-5 opacity-75" />
                    {t("nav.addColdLeads")}
                  </Link>
                </>
              )}
            </>
          )}

          {/* ===== DEALS ===== */}
          {hasRole("tele_sales_agent", "tele_sales_manager", "sales_agent", "sales_manager", "chief_sales") && (
            <>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-6 mb-2 px-3">{t("nav.deals")}</div>
              <Link href="/dashboard/deals" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                <Handshake className="me-3 h-5 w-5 opacity-75" />
                {t("nav.deals")}
              </Link>
            </>
          )}

          {/* ===== SALES ===== */}
          {hasRole("sales_agent", "sales_manager") && (
            <>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-6 mb-2 px-3">{t("nav.section.sales")}</div>
              <Link href="/dashboard/sales" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                <Briefcase className="me-3 h-5 w-5 opacity-75" />
                {t("nav.opportunities")}
              </Link>
              {hasRole("sales_manager") && (
                <>
                  <Link href="/dashboard/sales/my-team" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                    <Users className="me-3 h-5 w-5 opacity-75" />
                    {t("nav.myTeam")}
                  </Link>
                  <Link href="/dashboard/sales/analytics" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                    <BarChart3 className="me-3 h-5 w-5 opacity-75" />
                    {t("nav.teamAnalytics")}
                  </Link>
                  {role === "sales_manager" && (
                    <Link href="/dashboard/sales/my-target" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                      <Target className="me-3 h-5 w-5 opacity-75" />
                      {t("nav.myTarget")}
                    </Link>
                  )}
                  <Link href="/dashboard/sales/recycle-bin" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                    <RotateCcw className="me-3 h-5 w-5 opacity-75" />
                    {t("nav.recycleBin")}
                  </Link>
                </>
              )}
              {role === "sales_agent" && (
                <>
                  <Link href="/dashboard/sales/my-progress" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                    <TrendingUp className="me-3 h-5 w-5 opacity-75" />
                    {t("nav.myProgress")}
                  </Link>
                  <Link href="/dashboard/sales/my-target" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                    <Target className="me-3 h-5 w-5 opacity-75" />
                    {t("nav.myTarget")}
                  </Link>
                </>
              )}
            </>
          )}

          {/* ===== ACCOUNT MANAGEMENT ===== */}
          {hasRole("head_account_manager", "account_manager") && (
            <>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-6 mb-2 px-3">{t("nav.section.accountManagement")}</div>
              {hasRole("head_account_manager") && (
                <Link href="/dashboard/head-account-manager" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                  <Shield className="me-3 h-5 w-5 opacity-75" />
                  {t("nav.allProjects")}
                </Link>
              )}
              {hasRole("account_manager") && (
                <Link href="/dashboard/account-manager" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                  <Briefcase className="me-3 h-5 w-5 opacity-75" />
                  {t("nav.myClients")}
                </Link>
              )}
              <Link href="/dashboard/operations" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                <ListTodo className="me-3 h-5 w-5 opacity-75" />
                {t("nav.projectsTasks")}
              </Link>
              {hasRole("head_account_manager") && (
                <Link href="/dashboard/operations/packages" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                  <Package className="me-3 h-5 w-5 opacity-75" />
                  {t("nav.packagesSettings")}
                </Link>
              )}
            </>
          )}

          {/* ===== HEAD TECHNICAL ===== */}
          {hasRole("head_technical") && (
            <>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-6 mb-2 px-3">{t("nav.section.technical")}</div>
              <Link href="/dashboard/head-technical" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                <Monitor className="me-3 h-5 w-5 opacity-75" />
                {t("nav.technicalOverview")}
              </Link>
              <Link href="/dashboard/operations" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                <ClipboardList className="me-3 h-5 w-5 opacity-75" />
                {t("nav.allClientProjects")}
              </Link>
            </>
          )}

          {/* ===== SEO TEAM ===== */}
          {hasRole("head_seo", "team_leader_seo", "agent_seo", "agent_content_seo") && (
            <>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-6 mb-2 px-3">{t("nav.section.seo")}</div>
              <Link href="/dashboard/seo" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                <Search className="me-3 h-5 w-5 opacity-75" />
                {hasRole("head_seo", "team_leader_seo") ? t("nav.seoProjects") : t("nav.myTasks")}
              </Link>
            </>
          )}

          {/* ===== SOCIAL MEDIA TEAM ===== */}
          {hasRole("team_leader_social_media", "agent_social_media") && (
            <>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-6 mb-2 px-3">{t("nav.section.socialMedia")}</div>
              <Link href="/dashboard/social-media" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                <Megaphone className="me-3 h-5 w-5 opacity-75" />
                {hasRole("team_leader_social_media") ? t("nav.socialProjects") : t("nav.myTasks")}
              </Link>
            </>
          )}

          {/* ===== MEDIA BUYER TEAM ===== */}
          {hasRole("team_leader_media_buyer", "agent_media_buyer") && (
            <>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-6 mb-2 px-3">{t("nav.section.mediaBuying")}</div>
              <Link href="/dashboard/media-buyer" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                <ShoppingCart className="me-3 h-5 w-5 opacity-75" />
                {hasRole("team_leader_media_buyer") ? t("nav.campaigns") : t("nav.myTasks")}
              </Link>
            </>
          )}

          {/* ===== DESIGN TEAMS ===== */}
          {hasRole("leader_graphic_designer", "agent_graphic_designer", "leader_motion_graphic", "agent_motion_graphic", "leader_ui", "agent_ui") && (
            <>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-6 mb-2 px-3">{t("nav.section.design")}</div>
              {hasRole("leader_graphic_designer", "agent_graphic_designer") && (
                <Link href="/dashboard/design?team=graphic" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                  <Palette className="me-3 h-5 w-5 opacity-75" />
                  {t("nav.graphicDesign")}
                </Link>
              )}
              {hasRole("leader_motion_graphic", "agent_motion_graphic") && (
                <Link href="/dashboard/design?team=motion" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                  <Film className="me-3 h-5 w-5 opacity-75" />
                  {t("nav.motionGraphics")}
                </Link>
              )}
              {hasRole("leader_ui", "agent_ui") && (
                <Link href="/dashboard/design?team=ui" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                  <Layout className="me-3 h-5 w-5 opacity-75" />
                  {t("nav.uiUxDesign")}
                </Link>
              )}
            </>
          )}

          {/* ===== LEGACY OPERATIONS (team_leader / operations_agent) ===== */}
          {(role === "team_leader" || role === "operations_agent") && (
            <>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-6 mb-2 px-3">{t("nav.section.operations")}</div>
              <Link href="/dashboard/operations" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                <ListTodo className="me-3 h-5 w-5 opacity-75" />
                {t("nav.projectsTasks")}
              </Link>
            </>
          )}

          {/* ===== HR & FINANCE ===== */}
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-6 mb-2 px-3">{t("nav.section.hrFinance")}</div>
          {/* Attendance visible to everyone */}
          <Link href="/dashboard/hr" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
            <User className="me-3 h-5 w-5 opacity-75" />
            {t("nav.attendance")}
          </Link>
          {/* HR Management: only for hr_manager (+ super_admin via hasRole) */}
          {hasRole("hr_manager") && (
            <Link href="/dashboard/hr" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
              <Users className="me-3 h-5 w-5 opacity-75" />
              {t("nav.employeeDirectory")}
            </Link>
          )}
          {/* Finance: only for accountant (+ super_admin via hasRole) */}
          {hasRole("accountant") && (
            <Link href="/dashboard/finance" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
              <DollarSign className="me-3 h-5 w-5 opacity-75" />
              {t("nav.financeDashboard")}
            </Link>
          )}

          {/* ===== WARNINGS CENTER ===== */}
          {hasRole("chief_sales", "head_account_manager", "account_manager", "head_technical", "head_seo", "sales_manager", "team_leader_seo", "team_leader_social_media", "team_leader_media_buyer", "leader_graphic_designer", "leader_motion_graphic", "leader_ui", "agent_seo", "agent_content_seo", "agent_social_media", "agent_media_buyer", "agent_graphic_designer", "agent_motion_graphic", "agent_ui") && (
            <>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-6 mb-2 px-3">{t("nav.section.communication")}</div>
              <Link href="/dashboard/warnings" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
                <AlertTriangle className="me-3 h-5 w-5 opacity-75" />
                {t("nav.warningsCenter")}
              </Link>
            </>
          )}

          {role === "super_admin" && (
            <Link href="/dashboard/master-sheet" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors mt-2">
              <ClipboardList className="me-3 h-5 w-5 opacity-75" />
              {t("nav.globalMasterSheet")}
            </Link>
          )}

          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-6 mb-2 px-3">{t("nav.section.personal")}</div>
          <Link href="/dashboard/profile" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-slate-800 hover:text-white transition-colors">
            <User className="me-3 h-5 w-5 opacity-75" />
            {t("nav.myProfile")}
          </Link>
          </nav>
        }
      >
        {children}
      </DashboardShell>
    </>
  );
}
