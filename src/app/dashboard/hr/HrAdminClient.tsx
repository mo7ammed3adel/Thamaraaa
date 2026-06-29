"use client";

import { useState } from "react";
import {
  Users, UserPlus, UserCheck, Laptop, Plane, Clock, FileWarning, Cake,
  CalendarClock, Wallet, ChevronRight, LayoutDashboard,
} from "lucide-react";
import type { HrOverview } from "@/lib/hrOverview";
import HrEmployees from "./HrEmployees";

const MODULES = [
  { id: "dashboard", label: "Dashboard", live: true },
  { id: "employees", label: "Employees", live: true },
  { id: "departments", label: "Departments", live: false },
  { id: "requests", label: "Requests", live: false },
  { id: "documents", label: "Documents", live: false },
];

const TONE: Record<string, { bg: string; ring: string; text: string; icon: string }> = {
  slate: { bg: "bg-white", ring: "border-slate-200", text: "text-slate-900", icon: "bg-slate-100 text-slate-600" },
  blue: { bg: "bg-blue-50", ring: "border-blue-100", text: "text-blue-700", icon: "bg-blue-100 text-blue-600" },
  emerald: { bg: "bg-emerald-50", ring: "border-emerald-100", text: "text-emerald-700", icon: "bg-emerald-100 text-emerald-600" },
  violet: { bg: "bg-violet-50", ring: "border-violet-100", text: "text-violet-700", icon: "bg-violet-100 text-violet-600" },
  amber: { bg: "bg-amber-50", ring: "border-amber-100", text: "text-amber-700", icon: "bg-amber-100 text-amber-600" },
  rose: { bg: "bg-rose-50", ring: "border-rose-100", text: "text-rose-700", icon: "bg-rose-100 text-rose-600" },
};

function StatCard({ label, value, icon, tone = "slate" }: { label: string; value: number; icon: React.ReactNode; tone?: keyof typeof TONE | string }) {
  const t = TONE[tone] || TONE.slate;
  return (
    <div className={`rounded-2xl border ${t.ring} ${t.bg} p-4 shadow-sm`}>
      <div className="flex items-center justify-between">
        <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${t.icon}`}>{icon}</span>
      </div>
      <p className={`text-3xl font-black mt-3 ${t.text}`}>{value}</p>
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mt-1">{label}</p>
    </div>
  );
}

export default function HrAdminClient({ overview, userName, employees = [], departments = [], leaveRequests = [], salaryAdvances = [], complaints = [] }: {
  overview: HrOverview; userName?: string;
  employees?: any[]; departments?: any[]; leaveRequests?: any[]; salaryAdvances?: any[]; complaints?: any[];
}) {
  const [module, setModule] = useState("dashboard");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <LayoutDashboard className="w-6 h-6 text-blue-600" /> HR Workspace
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">{userName ? `Welcome, ${userName}. ` : ""}Here&apos;s what&apos;s happening across your team today.</p>
        </div>
        <nav className="flex flex-wrap gap-1.5">
          {MODULES.map((m) => (
            <button
              key={m.id}
              onClick={() => m.live && setModule(m.id)}
              disabled={!m.live}
              className={`px-3.5 py-2 rounded-xl text-sm font-semibold transition flex items-center gap-1.5 ${
                module === m.id ? "bg-slate-900 text-white" : m.live ? "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50" : "bg-slate-50 text-slate-300 cursor-not-allowed border border-transparent"
              }`}
            >
              {m.label}
              {!m.live && <span className="text-[9px] font-bold uppercase bg-slate-200 text-slate-400 rounded px-1 py-0.5">Soon</span>}
            </button>
          ))}
        </nav>
      </div>

      {module === "employees" && (
        <HrEmployees employees={employees} departments={departments} leaveRequests={leaveRequests} salaryAdvances={salaryAdvances} complaints={complaints} />
      )}

      {module === "dashboard" && (
      <>
      {/* Employee statistics */}
      <section>
        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Employee Statistics</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <StatCard label="Total Employees" value={overview.totalEmployees} icon={<Users className="w-5 h-5" />} tone="slate" />
          <StatCard label="New This Month" value={overview.newThisMonth} icon={<UserPlus className="w-5 h-5" />} tone="blue" />
          <StatCard label="Active" value={overview.activeEmployees} icon={<UserCheck className="w-5 h-5" />} tone="emerald" />
          <StatCard label="Remote Today" value={overview.remoteToday} icon={<Laptop className="w-5 h-5" />} tone="violet" />
          <StatCard label="On Leave Today" value={overview.onLeaveToday} icon={<Plane className="w-5 h-5" />} tone="amber" />
          <StatCard label="On Permission" value={overview.onPermissionToday} icon={<Clock className="w-5 h-5" />} tone="rose" />
        </div>
      </section>

      {/* Pending approvals */}
      <section>
        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Waiting for HR Approval</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Leave Requests" value={overview.pendingLeave} icon={<Plane className="w-5 h-5" />} tone="amber" />
          <StatCard label="Remote Requests" value={overview.pendingRemote} icon={<Laptop className="w-5 h-5" />} tone="violet" />
          <StatCard label="Permission Requests" value={overview.pendingPermission} icon={<Clock className="w-5 h-5" />} tone="blue" />
          <StatCard label="Salary Advances" value={overview.pendingAdvances} icon={<Wallet className="w-5 h-5" />} tone="emerald" />
        </div>
      </section>

      {/* Alerts */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Missing documents */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center"><FileWarning className="w-4 h-4" /></span>
            <h3 className="font-bold text-slate-800">Employees with Missing Documents</h3>
            <span className="ml-auto text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">{overview.missingDocs.length}</span>
          </div>
          <div className="max-h-72 overflow-y-auto divide-y divide-slate-50">
            {overview.missingDocs.length === 0 && <p className="px-5 py-8 text-center text-sm text-slate-400 italic">All required documents are on file. 🎉</p>}
            {overview.missingDocs.map((e) => (
              <div key={e.userId} className="px-5 py-3 flex items-start justify-between gap-3">
                <span className="font-semibold text-slate-800 text-sm">{e.name}</span>
                <div className="flex flex-wrap gap-1 justify-end">
                  {e.missing.map((d) => (
                    <span key={d} className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-100 rounded px-1.5 py-0.5">{d}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Birthdays + upcoming */}
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center"><Cake className="w-4 h-4" /></span>
              <h3 className="font-bold text-slate-800">Birthdays This Month</h3>
              <span className="ml-auto text-xs font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">{overview.birthdaysThisMonth.length}</span>
            </div>
            <div className="max-h-44 overflow-y-auto divide-y divide-slate-50">
              {overview.birthdaysThisMonth.length === 0 && <p className="px-5 py-6 text-center text-sm text-slate-400 italic">No birthdays this month.</p>}
              {overview.birthdaysThisMonth.map((b) => (
                <div key={b.userId} className="px-5 py-2.5 flex items-center justify-between text-sm">
                  <span className="font-semibold text-slate-800">{b.name}</span>
                  <span className="text-xs font-bold text-violet-600 flex items-center gap-1"><CalendarClock className="w-3.5 h-3.5" /> Day {b.day}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-br from-slate-900 to-slate-700 text-white rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <ChevronRight className="w-4 h-4" />
              <h3 className="font-bold">Building the new HR system</h3>
            </div>
            <p className="text-sm text-slate-300">This dashboard is the first module. Employees, Departments, Requests and the digital employee file are next — we&apos;re adding them one by one.</p>
          </div>
        </div>
      </section>
      </>
      )}
    </div>
  );
}
