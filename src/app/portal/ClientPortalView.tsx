"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, Clock, ExternalLink, LogOut, Wallet } from "lucide-react";
import { formatSarSuffix } from "@/shared/formatters/currency";
import { formatDate } from "@/shared/formatters/date";
import { logoutFromPortal } from "@/client/api/portal";
import type { ClientJourneyView, ClientPaymentsView } from "@/lib/clientPortal";
import type { ClientPortalData } from "@/server/services/clientPortalService";

const ARABIC_DATE_OPTIONS = { day: "numeric", month: "long", year: "numeric" } as const;

function fmtDate(value: string | null) {
  return value ? formatDate(value, { ...ARABIC_DATE_OPTIONS, fallback: "—" }) : "—";
}

function ProgressBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs font-medium text-slate-600">
        <span>{label}</span>
        <span>{Math.round(value)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-2 rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
    </div>
  );
}

function PaymentsCard({ payments }: { payments: ClientPaymentsView }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-slate-800">
        <Wallet className="h-5 w-5 text-emerald-600" />
        المدفوعات
      </h2>

      <div className="mb-5 grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-slate-50 p-3 text-center">
          <p className="text-[11px] font-bold uppercase text-slate-500">إجمالي العقد</p>
          <p className="mt-1 text-lg font-bold text-slate-800">{formatSarSuffix(payments.totalAmount)}</p>
        </div>
        <div className="rounded-xl bg-emerald-50 p-3 text-center">
          <p className="text-[11px] font-bold uppercase text-emerald-700">المدفوع</p>
          <p className="mt-1 text-lg font-bold text-emerald-700">{formatSarSuffix(payments.paidAmount)}</p>
        </div>
        <div className="rounded-xl bg-amber-50 p-3 text-center">
          <p className="text-[11px] font-bold uppercase text-amber-700">المتبقي</p>
          <p className="mt-1 text-lg font-bold text-amber-700">{formatSarSuffix(payments.remainingAmount)}</p>
        </div>
      </div>

      {payments.downPayment !== null && (
        <div className="mb-3 flex items-center justify-between rounded-lg border border-emerald-100 bg-emerald-50/50 px-3 py-2 text-sm">
          <span className="font-medium text-slate-700">الدفعة الأولى (عند التعاقد)</span>
          <span className="flex items-center gap-2">
            <span className="font-bold text-slate-800">{formatSarSuffix(payments.downPayment)}</span>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">مدفوع</span>
          </span>
        </div>
      )}

      {payments.installments.length === 0 ? (
        <p className="text-sm text-slate-400">مفيش أقساط مجدولة على العقد ده.</p>
      ) : (
        <ul className="space-y-2">
          {payments.installments.map((installment, index) => (
            <li
              key={`${installment.dueDate}-${index}`}
              className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
                installment.isPaid
                  ? "border-emerald-100 bg-emerald-50/50"
                  : installment.isOverdue
                    ? "border-red-200 bg-red-50"
                    : "border-slate-200 bg-white"
              }`}
            >
              <div>
                <span className="font-medium text-slate-700">القسط {index + 1}</span>
                <span className="mr-2 text-xs text-slate-500">استحقاق {fmtDate(installment.dueDate)}</span>
              </div>
              <span className="flex items-center gap-2">
                <span className="font-bold text-slate-800">{formatSarSuffix(installment.amount)}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                    installment.isPaid
                      ? "bg-emerald-100 text-emerald-700"
                      : installment.isOverdue
                        ? "bg-red-100 text-red-700"
                        : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {installment.statusLabel}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ProjectPanel({ project }: { project: ClientJourneyView }) {
  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-800">باقة {project.project.package}</h2>
            <p className="text-sm text-slate-500">
              من {fmtDate(project.project.contractStart)} إلى {fmtDate(project.project.contractEnd)}
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700">
            {project.project.statusLabel}
          </span>
        </div>

        <div className="mb-4 rounded-xl bg-emerald-50 p-4 text-center">
          <p className="text-xs font-bold uppercase text-emerald-700">نسبة الإنجاز الكلية</p>
          <p className="mt-1 text-3xl font-extrabold text-emerald-700">{Math.round(project.progress.overall)}%</p>
        </div>

        <div className="space-y-3">
          <ProgressBar label="تحسين محركات البحث (SEO)" value={project.progress.seo} />
          <ProgressBar label="السوشيال ميديا" value={project.progress.socialMedia} />
          <ProgressBar label="الإعلانات المموّلة" value={project.progress.mediaBuyer} />
        </div>

        {project.project.storeUrl && (
          <a
            href={project.project.storeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:underline"
          >
            <ExternalLink className="h-4 w-4" />
            متجرك
          </a>
        )}
      </section>

      {project.departments.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-base font-bold text-slate-800">الشغل الجاري</h2>
          <div className="space-y-5">
            {project.departments.map((department) => (
              <div key={department.department}>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-700">{department.label}</h3>
                  <span className="text-xs font-medium text-slate-500">
                    {department.completedCount} من {department.totalCount} تم
                  </span>
                </div>
                <ul className="space-y-2">
                  {department.tasks.map((task) => (
                    <li key={task.id} className="rounded-lg border border-slate-200 px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2 text-sm text-slate-700">
                          {task.status === "done" ? (
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                          ) : task.status === "in_progress" ? (
                            <Clock className="h-4 w-4 shrink-0 text-amber-500" />
                          ) : (
                            <Circle className="h-4 w-4 shrink-0 text-slate-300" />
                          )}
                          {task.title}
                        </span>
                        <span className="shrink-0 text-xs font-bold text-slate-500">{task.statusLabel}</span>
                      </div>
                      {task.deliverables.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2 pr-6">
                          {task.deliverables.map((deliverable) => (
                            <a
                              key={deliverable.url}
                              href={deliverable.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                            >
                              <ExternalLink className="h-3 w-3" />
                              {deliverable.label}
                            </a>
                          ))}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      <PaymentsCard payments={project.payments} />

      {project.timeline.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-base font-bold text-slate-800">رحلة مشروعك</h2>
          <ol className="space-y-3 border-r-2 border-slate-100 pr-4">
            {project.timeline.map((entry, index) => (
              <li key={`${entry.date}-${index}`} className="relative">
                <span className="absolute -right-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <p className="text-sm font-medium text-slate-700">{entry.title}</p>
                <p className="text-xs text-slate-400">{fmtDate(entry.date)}</p>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

export default function ClientPortalView({ data }: { data: ClientPortalData }) {
  const router = useRouter();
  const [activeProjectId, setActiveProjectId] = useState(data.projects[0]?.project.id || "");
  const [loggingOut, setLoggingOut] = useState(false);

  const activeProject =
    data.projects.find((project) => project.project.id === activeProjectId) || data.projects[0];

  async function handleLogout() {
    setLoggingOut(true);
    await logoutFromPortal().catch(() => undefined);
    router.replace("/portal/login");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">أهلاً بيك</p>
          <h1 className="text-2xl font-bold text-slate-800">{data.clientName}</h1>
        </div>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
        >
          <LogOut className="h-4 w-4" />
          خروج
        </button>
      </header>

      {data.projects.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
          لسه مفيش مشروع شغال على حسابك. مدير حسابك هيتواصل معاك قريب.
        </div>
      )}

      {data.projects.length > 1 && (
        <div className="mb-5 flex gap-2 overflow-x-auto rounded-xl bg-slate-100 p-1">
          {data.projects.map((project) => (
            <button
              key={project.project.id}
              onClick={() => setActiveProjectId(project.project.id)}
              className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition ${
                activeProject?.project.id === project.project.id
                  ? "bg-white text-slate-800 shadow"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              باقة {project.project.package}
            </button>
          ))}
        </div>
      )}

      {activeProject && <ProjectPanel project={activeProject} />}
    </div>
  );
}
