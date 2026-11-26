"use client";

import { useEffect, useRef } from "react";
import { MessageCircle, Phone, Video } from "lucide-react";
import { Avatar } from "./ChatBits";
import { useChatT } from "./useChatT";

export type UserCardTarget = { id: string; name: string; role?: string | null; online?: boolean; anchor: DOMRect };

/**
 * The little card that opens when you tap someone's name or photo (like
 * WhatsApp): message them privately, or call them straight away.
 */
export function UserCard({
  target,
  canCall,
  onClose,
  onMessage,
  onCall,
}: {
  target: UserCardTarget;
  canCall: boolean;
  onClose: () => void;
  onMessage: () => void;
  onCall: (video: boolean) => void;
}) {
  const { t } = useChatT();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const away = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    // Next tick, so the click that opened the card doesn't close it.
    const id = setTimeout(() => document.addEventListener("mousedown", away), 0);
    document.addEventListener("keydown", esc);
    return () => {
      clearTimeout(id);
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [onClose]);

  // Below the name when there's room, otherwise above; kept on screen.
  const width = 272;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const left = Math.max(8, Math.min(target.anchor.left, vw - width - 8));
  const below = target.anchor.bottom + 6;
  const top = below + 190 > vh ? Math.max(8, target.anchor.top - 196) : below;

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={target.name}
      className="fixed z-[55] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      style={{ left, top, width }}
      data-testid="user-card"
    >
      <div className="flex items-center gap-3 bg-gradient-to-br from-slate-900 to-slate-800 p-4">
        <Avatar name={target.name} seed={target.id} size={52} online={target.online} />
        <div className="min-w-0">
          <p className="truncate text-base font-bold text-white">{target.name}</p>
          {target.role && <p className="truncate text-xs capitalize text-slate-300">{target.role.replace(/_/g, " ")}</p>}
        </div>
      </div>
      <div className="flex gap-2 p-3">
        <button
          type="button"
          onClick={onMessage}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          data-testid="user-card-message"
        >
          <MessageCircle className="h-4 w-4" /> {t("sendMessage")}
        </button>
        {canCall && (
          <>
            <button type="button" onClick={() => onCall(false)} title={t("audioCall")} className="rounded-xl bg-slate-100 px-3 text-slate-700 hover:bg-slate-200" data-testid="user-card-call">
              <Phone className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => onCall(true)} title={t("videoCall")} className="rounded-xl bg-slate-100 px-3 text-slate-700 hover:bg-slate-200">
              <Video className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
