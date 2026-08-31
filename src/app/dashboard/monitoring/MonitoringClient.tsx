"use client";

import { useCallback, useEffect, useState } from "react";
import { Monitor, Clock, Copy, Pause, Play, Ban, Plus, RefreshCw, Trash2, X, CheckSquare, Square, KeyRound, Pencil, UserCog } from "lucide-react";
import { formatDateTime } from "@/shared/formatters/date";
import {
  enrolDevice,
  listDevices,
  listScreenshots,
  setDeviceStatus,
  setInterval as setIntervalApi,
  setRetention as setRetentionApi,
  deleteScreenshots as deleteScreenshotsApi,
  reissueDeviceToken as reissueDeviceTokenApi,
  updateDevice as updateDeviceApi,
  deleteDevice as deleteDeviceApi,
  type MonitoredDevice,
  type ScreenshotRow,
} from "@/client/api/devices";
import { HttpError } from "@/client/transport/http";

type EnrollableUser = { id: string; name: string; role: string };

const STATUS_TONE: Record<string, string> = {
  Active: "bg-emerald-100 text-emerald-700",
  Paused: "bg-amber-100 text-amber-700",
  Revoked: "bg-red-100 text-red-700",
};

export default function MonitoringClient({
  devices: initialDevices,
  users,
  interval: initialInterval,
  retentionDays: initialRetentionDays,
}: {
  devices: MonitoredDevice[];
  users: EnrollableUser[];
  interval: number;
  retentionDays: number;
}) {
  const [devices, setDevices] = useState(initialDevices);
  const [interval, setIntervalState] = useState(initialInterval);
  const [intervalDraft, setIntervalDraft] = useState(String(initialInterval));
  const [retentionDays, setRetentionDays] = useState(initialRetentionDays);
  const [retentionDraft, setRetentionDraft] = useState(String(initialRetentionDays));
  const [error, setError] = useState("");

  // Enrol modal
  const [enrolling, setEnrolling] = useState(false);
  const [enrolUserId, setEnrolUserId] = useState("");
  const [enrolLabel, setEnrolLabel] = useState("");
  const [issuedToken, setIssuedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Screenshot review
  const [filterUser, setFilterUser] = useState("");
  const [shots, setShots] = useState<ScreenshotRow[]>([]);
  const [loadingShots, setLoadingShots] = useState(false);
  const [lightbox, setLightbox] = useState<ScreenshotRow | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Per-device management: edit (owner/label), delete, or a freshly issued token
  const [editDevice, setEditDevice] = useState<MonitoredDevice | null>(null);
  const [editUserId, setEditUserId] = useState("");
  const [editLabel, setEditLabel] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteDeviceTarget, setDeleteDeviceTarget] = useState<MonitoredDevice | null>(null);
  const [deletingDevice, setDeletingDevice] = useState(false);
  const [reissued, setReissued] = useState<{ device: MonitoredDevice; token: string } | null>(null);
  const [reissueCopied, setReissueCopied] = useState(false);

  const refreshDevices = useCallback(async () => {
    try {
      setDevices((await listDevices()).devices);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : "Failed to refresh devices");
    }
  }, []);

  const loadShots = useCallback(async () => {
    setLoadingShots(true);
    try {
      const result = await listScreenshots({ userId: filterUser || undefined, page: 1 });
      setShots(result.screenshots);
      // Drop the selection with the list, so a delete can only ever hit shots
      // that are actually on screen.
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof HttpError ? err.message : "Failed to load screenshots");
    } finally {
      setLoadingShots(false);
    }
  }, [filterUser]);

  useEffect(() => {
    loadShots();
  }, [loadShots]);

  async function saveInterval() {
    setError("");
    try {
      const result = await setIntervalApi(Number(intervalDraft));
      setIntervalState(result.minutes);
      setIntervalDraft(String(result.minutes));
    } catch (err) {
      setError(err instanceof HttpError ? err.message : "Failed to save interval");
    }
  }

  async function saveRetention() {
    setError("");
    try {
      const result = await setRetentionApi(Number(retentionDraft));
      setRetentionDays(result.days);
      setRetentionDraft(String(result.days));
    } catch (err) {
      setError(err instanceof HttpError ? err.message : "Failed to save retention");
    }
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) => (prev.size === shots.length ? new Set() : new Set(shots.map((s) => s.id))));
  }

  async function handleDeleteSelected() {
    setError("");
    setDeleting(true);
    try {
      const result = await deleteScreenshotsApi(Array.from(selected));
      setConfirmDelete(false);
      if (result.failed > 0) {
        setError(`اتمسح ${result.deleted}، وفشل ${result.failed} — جرب تاني`);
      }
      await loadShots();
      await refreshDevices();
    } catch (err) {
      setError(err instanceof HttpError ? err.message : "Failed to delete screenshots");
    } finally {
      setDeleting(false);
    }
  }

  function openEdit(d: MonitoredDevice) {
    setEditDevice(d);
    setEditUserId(d.user.id);
    setEditLabel(d.label || "");
    setError("");
  }

  async function saveEdit() {
    if (!editDevice) return;
    setSavingEdit(true);
    setError("");
    try {
      await updateDeviceApi(editDevice.id, {
        userId: editUserId,
        label: editLabel.trim() || null,
      });
      setEditDevice(null);
      await refreshDevices();
    } catch (err) {
      setError(err instanceof HttpError ? err.message : "Failed to update device");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleReissue(d: MonitoredDevice) {
    setError("");
    try {
      const result = await reissueDeviceTokenApi(d.id);
      setReissued({ device: d, token: result.token });
      setReissueCopied(false);
      await refreshDevices();
    } catch (err) {
      setError(err instanceof HttpError ? err.message : "Failed to reissue token");
    }
  }

  async function confirmDeleteDevice() {
    if (!deleteDeviceTarget) return;
    setDeletingDevice(true);
    setError("");
    try {
      await deleteDeviceApi(deleteDeviceTarget.id);
      setDeleteDeviceTarget(null);
      await refreshDevices();
      await loadShots();
    } catch (err) {
      setError(err instanceof HttpError ? err.message : "Failed to delete device");
    } finally {
      setDeletingDevice(false);
    }
  }

  async function handleEnrol() {
    if (!enrolUserId) return;
    setError("");
    try {
      const result = await enrolDevice({ userId: enrolUserId, label: enrolLabel.trim() || undefined });
      setIssuedToken(result.token);
      await refreshDevices();
    } catch (err) {
      setError(err instanceof HttpError ? err.message : "Failed to enrol device");
    }
  }

  async function changeStatus(id: string, status: "Active" | "Paused" | "Revoked") {
    setError("");
    try {
      await setDeviceStatus(id, status);
      await refreshDevices();
    } catch (err) {
      setError(err instanceof HttpError ? err.message : "Failed to update device");
    }
  }

  function closeEnrol() {
    setEnrolling(false);
    setEnrolUserId("");
    setEnrolLabel("");
    setIssuedToken(null);
    setCopied(false);
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
            <Monitor className="h-6 w-6 text-indigo-600" />
            مراقبة الأجهزة
          </h1>
          <p className="text-sm text-slate-500">
            تسجيل أجهزة الموظفين ومراجعة اللقطات. المراقبة معلنة للموظف — الـ Agent بيبان في شريط المهام.
          </p>
        </div>
        <button
          onClick={() => setEnrolling(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" /> تسجيل جهاز جديد
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {/* Capture settings */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Interval control */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-700">
            <Clock className="h-4 w-4 text-slate-500" /> مدة التقاط اللقطة
          </h2>
          <div className="flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">كل كام دقيقة</span>
              <input
                type="number"
                min={1}
                max={60}
                value={intervalDraft}
                onChange={(e) => setIntervalDraft(e.target.value)}
                className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </label>
            <button
              onClick={saveInterval}
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-900"
            >
              حفظ
            </button>
          </div>
          <p className="mt-3 text-sm text-slate-500">
            الحالي: كل <strong className="text-slate-800">{interval}</strong> دقيقة (من 1 لـ 60)
          </p>
        </section>

        {/* Retention control */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-700">
            <Trash2 className="h-4 w-4 text-slate-500" /> مدة الاحتفاظ باللقطات
          </h2>
          <div className="flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">تتمسح بعد كام يوم</span>
              <input
                type="number"
                min={1}
                max={365}
                value={retentionDraft}
                onChange={(e) => setRetentionDraft(e.target.value)}
                className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </label>
            <button
              onClick={saveRetention}
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-900"
            >
              حفظ
            </button>
          </div>
          <p className="mt-3 text-sm text-slate-500">
            اللقطات بتتمسح تلقائيًا بعد <strong className="text-slate-800">{retentionDays}</strong> يوم (من 1 لـ 365)
            — الصورة والسجل مع بعض.
          </p>
        </section>
      </div>

      {/* Devices */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-bold text-slate-700">الأجهزة المسجّلة ({devices.length})</h2>
          <button onClick={refreshDevices} className="text-slate-400 transition hover:text-slate-600">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
        {devices.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-400">مفيش أجهزة مسجّلة لسه.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3 text-start">الموظف</th>
                  <th className="px-5 py-3 text-start">الجهاز</th>
                  <th className="px-5 py-3 text-center">الحالة</th>
                  <th className="px-5 py-3 text-center">اللقطات</th>
                  <th className="px-5 py-3 text-start">آخر ظهور</th>
                  <th className="px-5 py-3 text-end">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {devices.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <div className="font-medium text-slate-800">{d.user.name}</div>
                      <div className="text-xs text-slate-400">{d.user.role.replace(/_/g, " ")}</div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="text-slate-700">{d.label || "—"}</div>
                      <div className="text-xs text-slate-400">
                        {[d.hostname, d.platform].filter(Boolean).join(" · ") || "—"}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_TONE[d.status] || "bg-slate-100 text-slate-600"}`}>
                        {d.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center font-medium text-slate-700">{d._count.screenshots}</td>
                    <td className="px-5 py-3 text-slate-500">
                      {d.lastSeenAt ? formatDateTime(d.lastSeenAt) : "لسه ماظهرش"}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {d.status === "Active" && (
                          <button onClick={() => changeStatus(d.id, "Paused")} title="إيقاف مؤقت" className="rounded p-1.5 text-amber-600 hover:bg-amber-50">
                            <Pause className="h-4 w-4" />
                          </button>
                        )}
                        {d.status === "Paused" && (
                          <button onClick={() => changeStatus(d.id, "Active")} title="استئناف" className="rounded p-1.5 text-emerald-600 hover:bg-emerald-50">
                            <Play className="h-4 w-4" />
                          </button>
                        )}
                        {d.status !== "Revoked" && (
                          <button onClick={() => changeStatus(d.id, "Revoked")} title="إلغاء الجهاز" className="rounded p-1.5 text-red-600 hover:bg-red-50">
                            <Ban className="h-4 w-4" />
                          </button>
                        )}
                        <span className="mx-0.5 h-4 w-px bg-slate-200" />
                        <button onClick={() => handleReissue(d)} title="توكن جديد" className="rounded p-1.5 text-indigo-600 hover:bg-indigo-50">
                          <KeyRound className="h-4 w-4" />
                        </button>
                        <button onClick={() => openEdit(d)} title="تعديل (الموظف / الاسم)" className="rounded p-1.5 text-slate-600 hover:bg-slate-100">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => setDeleteDeviceTarget(d)} title="حذف الجهاز نهائيًا" className="rounded p-1.5 text-red-600 hover:bg-red-50">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Screenshots */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-slate-700">آخر اللقطات</h2>
          <select
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">كل الموظفين</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>

        {loadingShots ? (
          <p className="py-8 text-center text-sm text-slate-400">جاري التحميل...</p>
        ) : shots.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">مفيش لقطات في الفترة دي.</p>
        ) : (
          <>
            {/* Selection toolbar */}
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <button
                onClick={toggleSelectAll}
                className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-900"
              >
                {selected.size === shots.length ? (
                  <CheckSquare className="h-4 w-4 text-indigo-600" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
                {selected.size === shots.length ? "إلغاء تحديد الكل" : "تحديد الكل"}
              </button>
              {selected.size > 0 && (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-500">
                    متحدد <strong className="text-slate-800">{selected.size}</strong>
                  </span>
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-red-700"
                  >
                    <Trash2 className="h-4 w-4" /> مسح المحدد
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {shots.map((shot) => {
                const isSelected = selected.has(shot.id);
                return (
                  <div
                    key={shot.id}
                    className={`group relative overflow-hidden rounded-lg border transition ${
                      isSelected
                        ? "border-indigo-500 ring-2 ring-indigo-200"
                        : "border-slate-200 hover:border-indigo-300 hover:shadow"
                    }`}
                  >
                    {/* The tick is its own control, so clicking the image still
                        opens it rather than selecting it by accident. */}
                    <button
                      onClick={() => toggleSelected(shot.id)}
                      aria-label={isSelected ? "إلغاء التحديد" : "تحديد اللقطة"}
                      className="absolute end-2 top-2 z-10 rounded-md bg-white/90 p-1 shadow-sm transition hover:bg-white"
                    >
                      {isSelected ? (
                        <CheckSquare className="h-4 w-4 text-indigo-600" />
                      ) : (
                        <Square className="h-4 w-4 text-slate-400" />
                      )}
                    </button>
                    <button onClick={() => setLightbox(shot)} className="block w-full text-start">
                      <div className="aspect-video bg-slate-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/devices/screenshots/${shot.id}/image`}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                        />
                      </div>
                      <div className="p-2">
                        <div className="truncate text-xs font-medium text-slate-700">{shot.user.name}</div>
                        <div className="text-[11px] text-slate-400">{formatDateTime(shot.capturedAt)}</div>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>

      {/* Enrol modal */}
      {enrolling && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-4">
              <h3 className="text-lg font-semibold text-slate-900">تسجيل جهاز</h3>
              <button onClick={closeEnrol} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4 px-5 py-5">
              {!issuedToken ? (
                <>
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-slate-700">الموظف</span>
                    <select
                      value={enrolUserId}
                      onChange={(e) => setEnrolUserId(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">اختار موظف...</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>{u.name} — {u.role.replace(/_/g, " ")}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-slate-700">اسم الجهاز (اختياري)</span>
                    <input
                      value={enrolLabel}
                      onChange={(e) => setEnrolLabel(e.target.value)}
                      placeholder="مثال: كمبيوتر المكتب"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </label>
                  <button
                    onClick={handleEnrol}
                    disabled={!enrolUserId}
                    className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
                  >
                    إنشاء توكن الجهاز
                  </button>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <p className="mb-2 text-xs font-bold text-amber-800">
                      توكن الجهاز — مش هيظهر تاني بعد ما تقفل النافذة. حطّه في الـ Agent على جهاز الموظف.
                    </p>
                    <p dir="ltr" className="mb-2 break-all rounded bg-white px-2 py-2 text-center font-mono text-xs text-slate-900">
                      {issuedToken}
                    </p>
                    <button
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(issuedToken);
                          setCopied(true);
                        } catch {
                          setError("المتصفح منع النسخ — انسخ التوكن يدوي.");
                        }
                      }}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-amber-700"
                    >
                      <Copy className="h-4 w-4" /> {copied ? "تم النسخ" : "نسخ التوكن"}
                    </button>
                  </div>
                  <button onClick={closeEnrol} className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                    تمام
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
        >
          <div className="max-h-full max-w-6xl overflow-auto" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/devices/screenshots/${lightbox.id}/image`} alt="" className="rounded-lg" />
            <div className="mt-2 flex items-center justify-center gap-4 text-sm text-white/80">
              <span>
                {lightbox.user.name} · {formatDateTime(lightbox.capturedAt)}
              </span>
              <button
                onClick={() => {
                  setSelected(new Set([lightbox.id]));
                  setLightbox(null);
                  setConfirmDelete(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600/90 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-red-600"
              >
                <Trash2 className="h-3.5 w-3.5" /> مسح اللقطة دي
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation -- the image is gone for good, so this is a stop,
          not a formality. */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="px-5 py-5">
              <div className="mb-3 flex items-center gap-2">
                <span className="rounded-full bg-red-100 p-2">
                  <Trash2 className="h-5 w-5 text-red-600" />
                </span>
                <h3 className="text-lg font-semibold text-slate-900">مسح اللقطات</h3>
              </div>
              <p className="text-sm text-slate-600">
                هتمسح <strong className="text-slate-900">{selected.size}</strong> لقطة نهائيًا — الصورة
                والسجل مع بعض. مفيش رجوع في العملية دي
              </p>
            </div>
            <div className="flex gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
              <button
                onClick={handleDeleteSelected}
                disabled={deleting}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
              >
                {deleting ? "بيمسح..." : "أيوه، امسحها"}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-white disabled:opacity-60"
              >
                رجوع
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit device — reassign owner and/or rename */}
      {editDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-4">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <UserCog className="h-5 w-5 text-slate-500" /> تعديل الجهاز
              </h3>
              <button onClick={() => setEditDevice(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 px-5 py-5">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">الموظف صاحب الجهاز</span>
                <select
                  value={editUserId}
                  onChange={(e) => setEditUserId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {/* the current owner may not be in the enrollable list (e.g. left),
                      so keep them as an explicit option */}
                  {!users.some((u) => u.id === editDevice.user.id) && (
                    <option value={editDevice.user.id}>{editDevice.user.name} (الحالي)</option>
                  )}
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name} — {u.role.replace(/_/g, " ")}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">اسم الجهاز</span>
                <input
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  placeholder="مثال: كمبيوتر المكتب"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </label>
              <p className="rounded-lg bg-slate-50 p-2.5 text-xs text-slate-500">
                نقل الجهاز لموظف تاني مش بيغيّر التوكن — نفس الجهاز يكمّل تصوير، بس اللقطات الجديدة تتحسب على الموظف الجديد. اللقطات القديمة تفضل باسم صاحبها وقتها.
              </p>
            </div>
            <div className="flex gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
              <button
                onClick={saveEdit}
                disabled={savingEdit}
                className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
              >
                {savingEdit ? "بيحفظ..." : "حفظ"}
              </button>
              <button
                onClick={() => setEditDevice(null)}
                disabled={savingEdit}
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-white disabled:opacity-60"
              >
                رجوع
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Freshly issued token — shown once, exactly like enrolment */}
      {reissued && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-4">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <KeyRound className="h-5 w-5 text-indigo-600" /> توكن جديد للجهاز
              </h3>
              <button onClick={() => setReissued(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3 px-5 py-5">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="mb-2 text-xs font-bold text-amber-800">
                  التوكن القديم بطل دلوقتي. ده الجديد لـ «{reissued.device.label || reissued.device.user.name}» — مش هيظهر تاني. حطّه في الـ Agent على الجهاز.
                </p>
                <p dir="ltr" className="mb-2 break-all rounded bg-white px-2 py-2 text-center font-mono text-xs text-slate-900">
                  {reissued.token}
                </p>
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(reissued.token);
                      setReissueCopied(true);
                    } catch {
                      setError("المتصفح منع النسخ — انسخ التوكن يدوي.");
                    }
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-amber-700"
                >
                  <Copy className="h-4 w-4" /> {reissueCopied ? "تم النسخ" : "نسخ التوكن"}
                </button>
              </div>
              <button
                onClick={() => setReissued(null)}
                className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                تمام
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete device confirmation */}
      {deleteDeviceTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="px-5 py-5">
              <div className="mb-3 flex items-center gap-2">
                <span className="rounded-full bg-red-100 p-2">
                  <Trash2 className="h-5 w-5 text-red-600" />
                </span>
                <h3 className="text-lg font-semibold text-slate-900">حذف الجهاز</h3>
              </div>
              <p className="text-sm text-slate-600">
                هتحذف جهاز «{deleteDeviceTarget.label || deleteDeviceTarget.user.name}» نهائيًا ومعاه
                كل لقطاته (<strong className="text-slate-900">{deleteDeviceTarget._count.screenshots}</strong>).
                التوكن بتاعه بيموت، ومفيش رجوع
              </p>
            </div>
            <div className="flex gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
              <button
                onClick={confirmDeleteDevice}
                disabled={deletingDevice}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
              >
                {deletingDevice ? "بيحذف..." : "أيوه، احذفه"}
              </button>
              <button
                onClick={() => setDeleteDeviceTarget(null)}
                disabled={deletingDevice}
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-white disabled:opacity-60"
              >
                رجوع
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
