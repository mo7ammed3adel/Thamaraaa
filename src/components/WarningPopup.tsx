"use client";

import { useState, useEffect, useCallback } from "react";

interface WarningData {
  id: string;
  message: string;
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

  // Listen for real-time warnings via Pusher
  useEffect(() => {
    let pusherClient: any = null;
    let channel: any = null;

    const setupPusher = async () => {
      try {
        const PusherModule = await import("pusher-js");
        const Pusher = PusherModule.default;
        pusherClient = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY || "", {
          cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "eu",
        });
        channel = pusherClient.subscribe("warnings-channel");
        channel.bind("new-warning", (data: any) => {
          try {
            const roles = data.recipientRoles || [];
            if (roles.includes(userRole) && data.senderUserId !== userId) {
              const newWarning: WarningData = {
                id: data.id,
                message: data.message,
                senderRole: data.senderRole,
                senderUserId: data.senderUserId,
                createdAt: data.createdAt,
              };
              setWarnings((prev) => [newWarning, ...prev]);
              setActiveWarning((current) => current || newWarning);
            }
          } catch {}
        });
      } catch {}
    };

    setupPusher();
    return () => {
      if (channel) channel.unbind_all();
      if (pusherClient) pusherClient.unsubscribe("warnings-channel");
    };
  }, [userRole, userId]);

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

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden border-2 border-red-200 animate-in zoom-in-95">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-red-500 px-6 py-4 flex items-center gap-3">
          <span className="text-2xl">🚨</span>
          <h2 className="text-lg font-bold text-white">URGENT WARNING</h2>
          <span className="text-2xl">🚨</span>
          {warnings.length > 1 && (
            <span className="ml-auto bg-white/20 text-white text-xs px-2 py-1 rounded-full">
              +{warnings.length - 1} more
            </span>
          )}
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <p className="text-gray-800 text-base leading-relaxed whitespace-pre-wrap">
            {activeWarning.message}
          </p>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span className="capitalize font-medium text-gray-700">
              {activeWarning.senderRole.replace(/_/g, " ")}
            </span>
            <span>•</span>
            <span>{new Date(activeWarning.createdAt).toLocaleString()}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6">
          <button
            onClick={handleAcknowledge}
            disabled={acknowledging}
            className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-red-200"
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
