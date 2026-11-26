"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { formatDateTime } from "@/shared/formatters/date";
import { acknowledgeWarning, listWarnings } from "@/client/api/warnings";
import { useTranslator } from "@/components/i18n/LocaleProvider";
import { subscribe } from "@/lib/realtime/client";

interface WarningData {
  id: string;
  message: string;
  subject?: string;
  severity?: string;
  senderRole: string;
  senderUserId: string;
  createdAt: string;
  userAcknowledged?: boolean;
}

export default function WarningPopup({ userRole, userId }: { userRole: string; userId: string }) {
  const t = useTranslator();
  const [warnings, setWarnings] = useState<WarningData[]>([]);
  const [activeWarning, setActiveWarning] = useState<WarningData | null>(null);
  const [acknowledging, setAcknowledging] = useState(false);

  // Load unacknowledged warnings on mount and whenever a new one is announced.
  // Acknowledged here this session: a refetch that raced the acknowledge must
  // not bring the warning back.
  const acked = useRef(new Set<string>());
  const load = useCallback(() => {
    listWarnings()
      .then((data: WarningData[]) => {
        const unacked = data.filter((w) => !w.userAcknowledged && w.senderUserId !== userId && !acked.current.has(w.id));
        setWarnings(unacked);
        setActiveWarning((current) => (current && unacked.some((w) => w.id === current.id) ? current : unacked[0] ?? null));
      })
      .catch(console.error);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  // The server fires `new-warning` on the user's own channel when a receipt is
  // created. That channel is public, so the event is only a signal — the
  // warning itself is always read back through the authenticated API.
  useEffect(() => {
    if (!userId) return;
    return subscribe(`user-${userId}`, "new-warning", load, {
      onLive: (live) => {
        if (live) load();
      },
    });
  }, [userId, load]);

  const handleAcknowledge = useCallback(async () => {
    if (!activeWarning) return;
    setAcknowledging(true);
    try {
      await acknowledgeWarning(activeWarning.id);
      acked.current.add(activeWarning.id);
      setWarnings((prev) => prev.filter((w) => w.id !== activeWarning.id));
      const remaining = warnings.filter((w) => w.id !== activeWarning.id);
      setActiveWarning(remaining.length > 0 ? remaining[0] : null);
    } catch (e) {
      console.error("Acknowledge error:", e);
    }
    setAcknowledging(false);
  }, [activeWarning, warnings]);

  if (!activeWarning) return null;

  const severityColor = activeWarning.severity === 'Critical' ? 'bg-red-900 border-red-900' : 
                        activeWarning.severity === 'High' ? 'bg-red-600 border-red-600' :
                        activeWarning.severity === 'Low' ? 'bg-amber-500 border-amber-500' : 'bg-red-500 border-red-500';

  const severityHeader = activeWarning.severity === 'Low' ? 'from-amber-600 to-amber-500' :
                         activeWarning.severity === 'Critical' ? 'from-slate-900 to-red-900' :
                         'from-red-600 to-red-500';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className={`bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden border-2 ${activeWarning.severity === 'Low' ? 'border-amber-200' : 'border-red-200'} animate-in zoom-in-95`}>
        {/* Header */}
        <div className={`bg-gradient-to-r ${severityHeader} px-6 py-4 flex items-center gap-3`}>
          <span className="text-2xl">{activeWarning.severity === 'Low' ? '⚠️' : '🚨'}</span>
          <div>
            <h2 className="text-lg font-bold text-white uppercase">{activeWarning.severity || "URGENT"} WARNING</h2>
            {activeWarning.subject && <p className="text-white/80 text-sm">{activeWarning.subject}</p>}
          </div>
          {warnings.length > 1 && (
            <span className="ms-auto bg-white/20 text-white text-xs px-2 py-1 rounded-full">
              +{warnings.length - 1} more
            </span>
          )}
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <p className="text-slate-800 text-base leading-relaxed whitespace-pre-wrap">
            {activeWarning.message}
          </p>
          <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-50 p-2 rounded-lg">
            <span className="font-bold">{t("warning.sentBy")}</span>
            <span className="capitalize font-medium text-slate-700">
              {activeWarning.senderRole.replace(/_/g, " ")}
            </span>
            <span>•</span>
            <span>{formatDateTime(activeWarning.createdAt)}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6">
          <button
            onClick={handleAcknowledge}
            disabled={acknowledging}
            className={`w-full py-3 ${severityColor} text-white font-bold rounded-xl transition-all duration-200 hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg`}
          >
            {acknowledging ? (
              <span className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <>
                <input type="checkbox" readOnly checked={false} className="w-4 h-4 accent-white" />
                I Have Read This Warning — ACKNOWLEDGE
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
