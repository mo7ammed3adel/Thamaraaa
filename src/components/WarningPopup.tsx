"use client";

import { useState, useEffect, useCallback } from "react";
import { formatDateTime } from "@/shared/formatters/date";

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
  const [warnings, setWarnings] = useState<WarningData[]>([]);
  const [activeWarning, setActiveWarning] = useState<WarningData | null>(null);
  const [acknowledging, setAcknowledging] = useState(false);

  // Load unacknowledged warnings on mount
  useEffect(() => {
    fetch("/api/warnings")
      .then((r) => r.json())
      .then((data: WarningData[]) => {
        const unacked = data.filter((w) => !w.userAcknowledged && w.senderUserId !== userId);
        setWarnings(unacked);
        if (unacked.length > 0) setActiveWarning(unacked[0]);
      })
      .catch(console.error);
  }, [userId]);

  // Listen for real-time warnings via Pusher.
  // The server creates a WarningReceipt for every affected user and fires `new-warning`
  // on that user's own channel (`user-${userId}`), so we trust delivery without needing role filtering.
  useEffect(() => {
    if (!userId) return;
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    if (!key) return;

    let pusherClient: any = null;
    let channel: any = null;
    const channelName = `user-${userId}`;

    const setupPusher = async () => {
      try {
        const PusherModule = await import("pusher-js");
        const Pusher = PusherModule.default;
        pusherClient = new Pusher(key, {
          cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "eu",
        });
        channel = pusherClient.subscribe(channelName);
        channel.bind("new-warning", (data: any) => {
          if (!data || data.senderUserId === userId) return;
          const newWarning: WarningData = {
            id: data.id,
            message: data.message,
            subject: data.subject,
            severity: data.severity,
            senderRole: data.senderRole,
            senderUserId: data.senderUserId,
            createdAt: data.createdAt,
          };
          setWarnings((prev) => (prev.find((w) => w.id === newWarning.id) ? prev : [...prev, newWarning]));
          setActiveWarning((current) => current || newWarning);
        });
      } catch (e) {
        console.error("WarningPopup pusher setup failed:", e);
      }
    };

    setupPusher();
    return () => {
      if (channel) channel.unbind_all();
      if (pusherClient) pusherClient.unsubscribe(channelName);
    };
  }, [userId]);

  const handleAcknowledge = useCallback(async () => {
    if (!activeWarning) return;
    setAcknowledging(true);
    try {
      await fetch(`/api/warnings/${activeWarning.id}/acknowledge`, { method: "POST" });
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
            <span className="ml-auto bg-white/20 text-white text-xs px-2 py-1 rounded-full">
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
            <span className="font-bold">Sent by:</span>
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
