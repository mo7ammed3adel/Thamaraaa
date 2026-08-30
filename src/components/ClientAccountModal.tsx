"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, KeyRound, Loader2, X } from "lucide-react";
import { formatDateTime } from "@/shared/formatters/date";
import {
  createClientAccount,
  getClientAccount,
  resetClientAccountPassword,
  setClientAccountStatus,
  type ClientAccountSummary,
} from "@/client/api/clientAccounts";
import { HttpError } from "@/client/transport/http";

type ClientAccountModalProps = {
  isOpen: boolean;
  onClose: () => void;
  /** The customer (Lead) the portal account belongs to. */
  leadId: string;
  clientName: string;
};

/**
 * Issues and manages a customer's Client Portal login.
 *
 * The one-time password is shown only in the response that created or reset it —
 * it is never stored in plain text, so it cannot be shown again afterwards.
 */
export default function ClientAccountModal({
  isOpen,
  onClose,
  leadId,
  clientName,
}: ClientAccountModalProps) {
  const [account, setAccount] = useState<ClientAccountSummary>(null);
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const loadAccount = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getClientAccount(leadId);
      setAccount(result.account);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : "تعذّر تحميل بيانات الحساب");
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    if (isOpen) {
      setTemporaryPassword("");
      setCopied(false);
      loadAccount();
    }
  }, [isOpen, loadAccount]);

  if (!isOpen) return null;

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (err) {
      setError(err instanceof HttpError ? err.message : "حصل خطأ. حاول تاني.");
    } finally {
      setBusy(false);
    }
  }

  const handleCreate = () =>
    run(async () => {
      const result = await createClientAccount(leadId);
      setTemporaryPassword(result.temporaryPassword);
      await loadAccount();
    });

  const handleReset = () =>
    run(async () => {
      const result = await resetClientAccountPassword(account!.id);
      setTemporaryPassword(result.temporaryPassword);
      await loadAccount();
    });

  const handleToggleStatus = () =>
    run(async () => {
      await setClientAccountStatus(account!.id, account!.status === "Active" ? "Suspended" : "Active");
      await loadAccount();
    });

  async function copyCredentials() {
    if (!account) return;
    const text = `رابط المتابعة: ${window.location.origin}/portal\nاسم المستخدم: ${account.username}\nكلمة المرور: ${temporaryPassword}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setError("المتصفح منع النسخ — انسخ البيانات يدويًا.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-gray-100 bg-slate-50 px-6 py-4">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
              <KeyRound className="h-5 w-5 text-emerald-600" />
              بيانات دخول العميل
            </h3>
            <p className="mt-0.5 truncate text-sm text-gray-500">{clientName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 transition hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}

          {loading ? (
            <div className="flex justify-center py-8 text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : !account ? (
            <>
              <p className="text-sm text-slate-600">
                لسه مفيش حساب للعميل ده. لما تنشئ الحساب، هيظهرلك اسم المستخدم وكلمة مرور مؤقتة
                <strong className="text-slate-800"> مرة واحدة بس</strong> — ابعتهالهم وهو هيغيّرها أول ما يدخل.
              </p>
              <button
                onClick={handleCreate}
                disabled={busy}
                className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
              >
                {busy ? "جاري الإنشاء..." : "إنشاء حساب للعميل"}
              </button>
            </>
          ) : (
            <>
              <dl className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">اسم المستخدم</dt>
                  <dd dir="ltr" className="font-bold text-slate-800">{account.username}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">الحالة</dt>
                  <dd
                    className={`font-bold ${account.status === "Active" ? "text-emerald-600" : "text-red-600"}`}
                  >
                    {account.status === "Active" ? "مفعّل" : "موقوف"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">آخر دخول</dt>
                  <dd className="font-medium text-slate-700">
                    {account.lastLoginAt ? formatDateTime(account.lastLoginAt) : "لسه مدخلش"}
                  </dd>
                </div>
              </dl>

              {temporaryPassword && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="mb-2 text-xs font-bold text-amber-800">
                    كلمة المرور المؤقتة — مش هتظهر تاني بعد ما تقفل النافذة
                  </p>
                  <p dir="ltr" className="mb-2 text-center font-mono text-lg font-bold text-slate-900">
                    {temporaryPassword}
                  </p>
                  <button
                    onClick={copyCredentials}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-amber-700"
                  >
                    <Copy className="h-4 w-4" />
                    {copied ? "تم النسخ" : "نسخ الرابط والبيانات"}
                  </button>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={handleReset}
                  disabled={busy}
                  className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                >
                  كلمة مرور جديدة
                </button>
                <button
                  onClick={handleToggleStatus}
                  disabled={busy}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium text-white transition disabled:opacity-60 ${
                    account.status === "Active"
                      ? "bg-red-600 hover:bg-red-700"
                      : "bg-emerald-600 hover:bg-emerald-700"
                  }`}
                >
                  {account.status === "Active" ? "إيقاف الدخول" : "إعادة التفعيل"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
