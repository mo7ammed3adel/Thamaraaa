"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, X, CheckCircle, Clock } from "lucide-react";
import PusherClient from "pusher-js";
import { formatDate } from "@/shared/formatters/date";

export default function GlobalWarningAlert({ userId }: { userId?: string }) {
  const [warnings, setWarnings] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loadingAcks, setLoadingAcks] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchWarnings();

    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    if (!key || !userId) return;

    // Subscribe to the user's own channel; the server emits `new-warning` here when receipts are created.
    const pusher = new PusherClient(key, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "eu",
    });

    const channelName = `user-${userId}`;
    const channel = pusher.subscribe(channelName);
    channel.bind("new-warning", () => {
      fetchWarnings();
    });

    return () => {
      pusher.unsubscribe(channelName);
    };
  }, [userId]);

  const fetchWarnings = async () => {
    try {
      const res = await fetch("/api/warnings");
      if (res.ok) {
        const data = await res.json();
        // Only show warnings that haven't been acknowledged by this user
        setWarnings(data.filter((w: any) => !w.userAcknowledged));
      }
    } catch (e) {
      console.error("Failed to fetch warnings", e);
    }
  };

  const handleAcknowledge = async (id: string) => {
    setLoadingAcks(prev => ({ ...prev, [id]: true }));
    try {
      const res = await fetch(`/api/warnings/${id}/acknowledge`, { method: "POST" });
      if (res.ok) {
        setWarnings(prev => prev.filter(w => w.id !== id));
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingAcks(prev => ({ ...prev, [id]: false }));
    }
  };

  if (warnings.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full">
      {/* Mini floating button if closed */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="self-end bg-red-600 text-white rounded-full p-4 shadow-lg flex items-center justify-center animate-bounce hover:bg-red-700 transition"
        >
          <AlertTriangle className="w-6 h-6" />
          <span className="absolute -top-2 -right-2 bg-white text-red-600 font-black text-xs w-6 h-6 rounded-full flex items-center justify-center shadow-sm">
            {warnings.length}
          </span>
        </button>
      )}

      {/* Expanded view */}
      {isOpen && (
        <div className="bg-white rounded-2xl shadow-2xl border-2 border-red-100 overflow-hidden flex flex-col max-h-[80vh]">
          <div className="bg-red-50 px-4 py-3 flex justify-between items-center border-b border-red-100 shrink-0">
            <h3 className="font-bold text-red-800 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Action Required ({warnings.length})
            </h3>
            <button onClick={() => setIsOpen(false)} className="text-red-500 hover:text-red-700 transition">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="overflow-y-auto p-4 flex flex-col gap-4">
            {warnings.map((w) => (
              <div key={w.id} className="bg-white border rounded-xl p-4 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />
                
                <h4 className="font-bold text-slate-800 mb-1 leading-tight">{w.subject}</h4>
                <p className="text-sm text-slate-600 mb-3">{w.message}</p>
                
                <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-500 mb-4 bg-slate-50 rounded-lg p-2">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    {w.severity} Priority
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDate(w.createdAt)}
                  </span>
                  <span>From: {w.senderRole.replace(/_/g, " ")}</span>
                </div>

                <button
                  disabled={loadingAcks[w.id]}
                  onClick={() => handleAcknowledge(w.id)}
                  className="w-full py-2 bg-red-50 hover:bg-red-100 text-red-700 font-bold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4" />
                  {loadingAcks[w.id] ? "Acknowledging..." : "Acknowledge Warning"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
