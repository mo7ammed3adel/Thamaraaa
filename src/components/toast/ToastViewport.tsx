"use client";

import { useEffect, useState, type ComponentType } from "react";
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from "lucide-react";
import { subscribe, dismissToast, type Toast, type ToastType } from "./toast-store";

type ToastStyle = {
  Icon: ComponentType<{ className?: string }>;
  iconColor: string;
  bar: string;
  ring: string;
};

const STYLES: Record<ToastType, ToastStyle> = {
  success: { Icon: CheckCircle2, iconColor: "text-emerald-500", bar: "bg-emerald-500", ring: "ring-emerald-100" },
  error: { Icon: XCircle, iconColor: "text-red-500", bar: "bg-red-500", ring: "ring-red-100" },
  warning: { Icon: AlertTriangle, iconColor: "text-amber-500", bar: "bg-amber-500", ring: "ring-amber-100" },
  info: { Icon: Info, iconColor: "text-indigo-500", bar: "bg-indigo-500", ring: "ring-indigo-100" },
};

const DURATIONS: Record<ToastType, number> = {
  success: 4000,
  info: 4000,
  warning: 5000,
  error: 6000,
};

function ToastItem({ toast }: { toast: Toast }) {
  const [leaving, setLeaving] = useState(false);
  const style = STYLES[toast.type];
  const { Icon } = style;
  const duration = DURATIONS[toast.type];

  useEffect(() => {
    const timer = setTimeout(() => setLeaving(true), duration);
    return () => clearTimeout(timer);
  }, [duration]);

  return (
    <div
      role="status"
      aria-live="polite"
      onAnimationEnd={(event) => {
        // Only the exit animation should remove the toast — the entry and the
        // progress-bar animations also bubble an animationend event here.
        if (event.animationName === "toast-out") dismissToast(toast.id);
      }}
      className={`pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-2xl border border-slate-100 bg-white py-4 ps-4 pe-10 shadow-2xl ring-1 ${style.ring} ${
        leaving ? "animate-toast-out" : "animate-toast-in"
      }`}
    >
      <span className={`absolute inset-y-0 left-0 w-1.5 ${style.bar}`} />
      <span className={`mt-0.5 shrink-0 ${style.iconColor}`}>
        <Icon className="h-5 w-5" />
      </span>
      <p className="text-sm font-semibold leading-snug text-slate-700 [overflow-wrap:anywhere]">
        {toast.message}
      </p>
      <button
        type="button"
        onClick={() => setLeaving(true)}
        aria-label="Dismiss"
        className="absolute right-2 top-2 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
      >
        <X className="h-4 w-4" />
      </button>
      <span
        className={`absolute bottom-0 left-0 h-1 ${style.bar} opacity-40 animate-toast-progress`}
        style={{ animationDuration: `${duration}ms` }}
      />
    </div>
  );
}

export default function ToastViewport() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => subscribe(setToasts), []);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed top-4 right-4 z-[100] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-3 sm:top-6 sm:right-6">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
