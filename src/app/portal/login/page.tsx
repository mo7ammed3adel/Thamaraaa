"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginToPortal } from "@/client/api/portal";
import { HttpError } from "@/client/transport/http";

export default function ClientPortalLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await loginToPortal({ username: username.trim(), password });
      router.replace(result.mustChangePassword ? "/portal/change-password" : "/portal");
      router.refresh();
    } catch (err) {
      setError(err instanceof HttpError ? err.message : "تعذّر الاتصال. حاول مرة تانية.");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
        {/* No company name on the client-facing login — the heading stands alone. */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">متابعة مشروعك</h1>
          <p className="mt-2 text-sm text-slate-500">ادخل ببيانات الدخول اللي وصلتك من مدير حسابك</p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-100 bg-red-50 p-3 text-center text-sm text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="portal-username" className="mb-2 block text-sm font-medium text-slate-700">
              اسم المستخدم
            </label>
            <input
              id="portal-username"
              type="text"
              required
              dir="ltr"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="رقم موبايلك"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-right text-slate-900 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label htmlFor="portal-password" className="mb-2 block text-sm font-medium text-slate-700">
              كلمة المرور
            </label>
            <input
              id="portal-password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-emerald-600 px-4 py-3 font-medium text-white shadow-md transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "جاري الدخول..." : "دخول"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-400">
          نسيت بياناتك؟ كلّم مدير حسابك وهيبعتهالك من جديد.
        </p>
      </div>
    </div>
  );
}
