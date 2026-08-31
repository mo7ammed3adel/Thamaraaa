"use client";

import { useMemo, useState } from "react";
import {
  Users,
  UserPlus,
  UserCheck,
  Laptop,
  Plane,
  Clock,
  FileWarning,
  Cake,
  CalendarClock,
  Wallet,
  ChevronRight,
  LayoutDashboard,
} from "lucide-react";
import type { HrOverview } from "@/lib/hrOverview";
import HrEmployees from "./HrEmployees";
import HrDepartments from "./HrDepartments";
import HrRequests from "./HrRequests";
import HrDocuments from "./HrDocuments";
import { OnboardingTab, PayrollTab, PerformanceTab, PromotionEngineTab, RecruitmentTab } from "./HrWorkflowTabs";
import ViralHrmClient from "./ViralHrmClient";

const MODULE_GROUPS = [
  {
    title: "Core",
    items: [
      { id: "dashboard", label: "Dashboard" },
      { id: "employees", label: "Employees" },
      { id: "departments", label: "Departments" },
      { id: "documents", label: "Documents" },
    ],
  },
  {
    title: "Requests",
    items: [
      { id: "requests", label: "Leave & Complaints" },
      { id: "requestCenter", label: "SLA Requests" },
      { id: "attendance", label: "Attendance" },
      { id: "workflows", label: "Workflows" },
    ],
  },
  {
    title: "Compensation",
    items: [
      { id: "payroll", label: "Payroll Summary" },
      { id: "payrollPeriods", label: "Payroll Periods" },
      { id: "compensation", label: "Salary Changes" },
      { id: "advances", label: "Advances" },
    ],
  },
  {
    title: "Talent",
    items: [
      { id: "performance", label: "Performance" },
      { id: "onboarding", label: "Onboarding" },
      { id: "recruitment", label: "Applicant Pipeline" },
      { id: "recruitmentRequests", label: "Hiring Requests" },
      { id: "talent", label: "Talent Pool" },
      { id: "promotion", label: "Promotion" },
      { id: "kpis", label: "KPI Templates" },
    ],
  },
  {
    title: "Admin",
    items: [
      { id: "peopleOps", label: "People Ops" },
      { id: "devicePasswords", label: "Device Access" },
      { id: "settings", label: "Settings" },
      { id: "audit", label: "Audit" },
    ],
  },
];

const ADVANCED_MODULES: Record<string, string> = {
  payrollPeriods: "payroll",
  compensation: "compensation",
  advances: "advances",
  requestCenter: "requests",
  workflows: "workflows",
  attendance: "attendance",
  recruitmentRequests: "recruitment",
  talent: "talent",
  kpis: "kpis",
  peopleOps: "peopleOps",
  devicePasswords: "devicePasswords",
  settings: "settings",
  audit: "audit",
};

const MODULE_LABELS = Object.fromEntries(
  MODULE_GROUPS.flatMap((group) => group.items.map((item) => [item.id, item.label]))
);

const TONE: Record<string, { text: string; icon: string }> = {
  slate: { text: "text-slate-900", icon: "bg-slate-100 text-slate-600" },
  blue: { text: "text-blue-700", icon: "bg-blue-50 text-blue-600" },
  emerald: { text: "text-emerald-700", icon: "bg-emerald-50 text-emerald-600" },
  violet: { text: "text-violet-700", icon: "bg-violet-50 text-violet-600" },
  amber: { text: "text-amber-700", icon: "bg-amber-50 text-amber-600" },
  rose: { text: "text-rose-700", icon: "bg-rose-50 text-rose-600" },
};

type HrAdminClientProps = {
  overview: HrOverview;
  userName?: string;
  employees?: any[];
  departments?: any[];
  leaveRequests?: any[];
  salaryAdvances?: any[];
  complaints?: any[];
};

function StatCard({
  label,
  value,
  icon,
  tone = "slate",
  onClick,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone?: keyof typeof TONE | string;
  onClick?: () => void;
}) {
  const t = TONE[tone] || TONE.slate;
  const className = `rounded-lg border border-slate-200 bg-white p-4 text-start shadow-sm transition ${
    onClick ? "cursor-pointer hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500" : ""
  }`;
  const content = (
    <div className="flex items-center gap-3">
      <span className={`w-9 h-9 rounded-lg flex shrink-0 items-center justify-center ${t.icon}`}>{icon}</span>
      <div className="min-w-0">
        <p className={`text-2xl font-black leading-none ${t.text}`}>{value}</p>
        <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      </div>
    </div>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}

export default function HrAdminClient({
  overview,
  userName,
  employees = [],
  departments = [],
  leaveRequests = [],
  salaryAdvances = [],
  complaints = [],
}: HrAdminClientProps) {
  const [module, setModule] = useState("dashboard");
  const activeLabel = useMemo(() => MODULE_LABELS[module] || "Dashboard", [module]);
  const advancedModule = ADVANCED_MODULES[module];

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-black text-slate-950">
              <LayoutDashboard className="h-6 w-6 text-blue-600" /> HR Workspace
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">{userName ? `Welcome, ${userName}.` : "Welcome."}</p>
          </div>
          <span className="inline-flex w-fit rounded-lg bg-slate-950 px-3 py-1.5 text-sm font-bold text-white">
            {activeLabel}
          </span>
        </div>

        <nav className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-5">
          {MODULE_GROUPS.map((group) => (
            <div key={group.title} className="min-w-0">
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{group.title}</p>
              <div className="flex flex-wrap gap-1.5">
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setModule(item.id)}
                    className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                      module === item.id
                        ? "bg-slate-950 text-white shadow-sm"
                        : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {module === "employees" && (
        <HrEmployees
          employees={employees}
          departments={departments}
          leaveRequests={leaveRequests}
          salaryAdvances={salaryAdvances}
          complaints={complaints}
        />
      )}

      {module === "departments" && <HrDepartments employees={employees} />}
      {module === "requests" && <HrRequests />}
      {module === "documents" && <HrDocuments employees={employees} />}
      {module === "payroll" && <PayrollTab />}
      {module === "performance" && <PerformanceTab employees={employees} />}
      {module === "onboarding" && <OnboardingTab employees={employees} />}
      {module === "recruitment" && <RecruitmentTab />}
      {module === "promotion" && <PromotionEngineTab />}
      {advancedModule && <ViralHrmClient module={advancedModule} />}

      {module === "dashboard" && (
        <>
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Employee Statistics</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
              <StatCard label="Total Employees" value={overview.totalEmployees} icon={<Users className="w-5 h-5" />} tone="slate" onClick={() => setModule("employees")} />
              <StatCard label="New This Month" value={overview.newThisMonth} icon={<UserPlus className="w-5 h-5" />} tone="blue" onClick={() => setModule("employees")} />
              <StatCard label="Active" value={overview.activeEmployees} icon={<UserCheck className="w-5 h-5" />} tone="emerald" onClick={() => setModule("employees")} />
              <StatCard label="Remote Today" value={overview.remoteToday} icon={<Laptop className="w-5 h-5" />} tone="violet" onClick={() => setModule("requests")} />
              <StatCard label="On Leave Today" value={overview.onLeaveToday} icon={<Plane className="w-5 h-5" />} tone="amber" onClick={() => setModule("requests")} />
              <StatCard label="On Permission" value={overview.onPermissionToday} icon={<Clock className="w-5 h-5" />} tone="rose" onClick={() => setModule("requests")} />
            </div>
          </section>

          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Waiting for HR Approval</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Leave Requests" value={overview.pendingLeave} icon={<Plane className="w-5 h-5" />} tone="amber" onClick={() => setModule("requests")} />
              <StatCard label="Remote Requests" value={overview.pendingRemote} icon={<Laptop className="w-5 h-5" />} tone="violet" onClick={() => setModule("requests")} />
              <StatCard label="Permission Requests" value={overview.pendingPermission} icon={<Clock className="w-5 h-5" />} tone="blue" onClick={() => setModule("requests")} />
              <StatCard label="Salary Advances" value={overview.pendingAdvances} icon={<Wallet className="w-5 h-5" />} tone="emerald" onClick={() => setModule("requests")} />
            </div>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center">
                  <FileWarning className="w-4 h-4" />
                </span>
                <h3 className="font-bold text-slate-800">Employees with Missing Documents</h3>
                <span className="ms-auto text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">{overview.missingDocs.length}</span>
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-50">
                {overview.missingDocs.length === 0 && (
                  <p className="px-5 py-8 text-center text-sm text-slate-400 italic">All required documents are on file.</p>
                )}
                {overview.missingDocs.map((employee) => (
                  <button
                    key={employee.userId}
                    type="button"
                    onClick={() => setModule("documents")}
                    className="w-full px-5 py-3 flex items-start justify-between gap-3 text-start hover:bg-slate-50"
                  >
                    <span className="font-semibold text-slate-800 text-sm">{employee.name}</span>
                    <span className="flex flex-wrap gap-1 justify-end">
                      {employee.missing.map((documentName) => (
                        <span key={documentName} className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-100 rounded px-1.5 py-0.5">
                          {documentName}
                        </span>
                      ))}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-5">
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center">
                    <Cake className="w-4 h-4" />
                  </span>
                  <h3 className="font-bold text-slate-800">Birthdays This Month</h3>
                  <span className="ms-auto text-xs font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">{overview.birthdaysThisMonth.length}</span>
                </div>
                <div className="max-h-44 overflow-y-auto divide-y divide-slate-50">
                  {overview.birthdaysThisMonth.length === 0 && (
                    <p className="px-5 py-6 text-center text-sm text-slate-400 italic">No birthdays this month.</p>
                  )}
                  {overview.birthdaysThisMonth.map((birthday) => (
                    <div key={birthday.userId} className="px-5 py-2.5 flex items-center justify-between text-sm">
                      <span className="font-semibold text-slate-800">{birthday.name}</span>
                      <span className="text-xs font-bold text-violet-600 flex items-center gap-1">
                        <CalendarClock className="w-3.5 h-3.5" /> Day {birthday.day}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <ChevronRight className="h-4 w-4 text-blue-600" />
                  <h3 className="font-bold text-slate-900">Quick Actions</h3>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ["employees", "Employees"],
                    ["requestCenter", "SLA Requests"],
                    ["recruitmentRequests", "Hiring Requests"],
                    ["payroll", "Payroll"],
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setModule(id)}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-start text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
