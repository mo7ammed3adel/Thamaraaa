"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Users as UsersIcon, Briefcase, FolderKanban, Wallet, UserCheck, AlertTriangle,
  Settings, FileSpreadsheet, ArrowRight, Phone,
} from "lucide-react";
import { useTranslator } from "@/components/i18n/LocaleProvider";

type RangeKey = "today" | "week" | "month" | "all";

interface RangeStats {
  leads: number;
  deals: number;
  revenue: number;
  projects: number;
}

interface SuperAdminClientProps {
  stats: Record<RangeKey, RangeStats>;
  activeEmployees: number;
  activeWarnings: number;
}

const RANGE_LABELS: { id: RangeKey; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "This Week" },
  { id: "month", label: "This Month" },
  { id: "all", label: "All Time" },
];

/**
 * Super Admin command-centre overview. Time-range buttons filter the headline
 * KPIs; every KPI card links through to the module that owns that data.
 */
export default function SuperAdminClient({ stats, activeEmployees, activeWarnings }: SuperAdminClientProps) {
  const t = useTranslator();
  const [range, setRange] = useState<RangeKey>("month");
  const s = stats[range];
  const fmt = (n: number) => new Intl.NumberFormat("en-US").format(Math.round(n));

  const kpis = [
    { label: "Leads", value: fmt(s.leads), icon: Phone, href: "/dashboard/master-sheet", color: "indigo" },
    { label: "Deals Won", value: fmt(s.deals), icon: Briefcase, href: "/dashboard/deals", color: "emerald" },
    { label: "Revenue (SAR)", value: fmt(s.revenue), icon: Wallet, href: "/dashboard/finance", color: "amber" },
    { label: "Projects", value: fmt(s.projects), icon: FolderKanban, href: "/dashboard/operations", color: "blue" },
    { label: "Active Employees", value: fmt(activeEmployees), icon: UserCheck, href: "/dashboard/hr", color: "violet", static: true },
    { label: "Active Warnings", value: fmt(activeWarnings), icon: AlertTriangle, href: "/dashboard/warnings", color: "red", static: true },
  ];

  const colorMap: Record<string, { bg: string; text: string; ring: string }> = {
    indigo: { bg: "bg-indigo-50", text: "text-indigo-600", ring: "hover:ring-indigo-300" },
    emerald: { bg: "bg-emerald-50", text: "text-emerald-600", ring: "hover:ring-emerald-300" },
    amber: { bg: "bg-amber-50", text: "text-amber-600", ring: "hover:ring-amber-300" },
    blue: { bg: "bg-blue-50", text: "text-blue-600", ring: "hover:ring-blue-300" },
    violet: { bg: "bg-violet-50", text: "text-violet-600", ring: "hover:ring-violet-300" },
    red: { bg: "bg-red-50", text: "text-red-600", ring: "hover:ring-red-300" },
  };

  const quickLinks = [
    { label: "Users", desc: "Create & manage employees", icon: UsersIcon, href: "/dashboard/users" },
    { label: "System Config", desc: "Fees, tiers, salaries, permissions", icon: Settings, href: "/dashboard/settings" },
    { label: "Master Sheet", desc: "Full lead → project journey", icon: FileSpreadsheet, href: "/dashboard/master-sheet" },
    { label: "Finance", desc: "Revenue, installments, payroll", icon: Wallet, href: "/dashboard/finance" },
    { label: "HR Hub", desc: "Attendance, hiring, promotions", icon: UserCheck, href: "/dashboard/hr" },
    { label: "Warnings", desc: "Active client warnings", icon: AlertTriangle, href: "/dashboard/warnings" },
  ];

  return (
    <div className="space-y-6">
      {/* Time range filter */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-slate-500 me-2">{t("dashboard.rangeLabel")}</span>
        {RANGE_LABELS.map((r) => (
          <button
            key={r.id}
            onClick={() => setRange(r.id)}
            className={`px-4 py-2 rounded-lg text-sm font-bold border transition ${
              range === r.id
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {kpis.map((k) => {
          const c = colorMap[k.color];
          return (
            <Link
              key={k.label}
              href={k.href}
              className={`group p-5 rounded-2xl border border-slate-200 bg-white shadow-sm transition ring-1 ring-transparent ${c.ring} hover:shadow-md`}
            >
              <div className="flex items-center justify-between">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.bg}`}>
                  <k.icon className={`w-5 h-5 ${c.text}`} />
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition" />
              </div>
              <p className="text-3xl font-black text-slate-900 mt-3">{k.value}</p>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mt-1">
                {k.label}
                {!k.static && <span className="ms-1 text-slate-300">· {RANGE_LABELS.find((r) => r.id === range)?.label}</span>}
              </p>
            </Link>
          );
        })}
      </div>

      {/* Quick links */}
      <div>
        <h2 className="text-lg font-bold text-slate-800 mb-3">{t("nav.section.administration")}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickLinks.map((q) => (
            <Link
              key={q.label}
              href={q.href}
              className="group flex items-center gap-4 p-4 rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-md hover:border-slate-300 transition"
            >
              <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center group-hover:bg-slate-900 transition">
                <q.icon className="w-5 h-5 text-slate-600 group-hover:text-white transition" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-slate-800">{q.label}</p>
                <p className="text-xs text-slate-500">{q.desc}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 transition" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
