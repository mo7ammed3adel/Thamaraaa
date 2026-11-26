"use client";

import { Phone, PhoneOff, Video } from "lucide-react";
import type { CallInfo } from "@/client/api/chat";
import { Avatar } from "../ChatBits";
import { useChatT } from "../useChatT";

/** The ringing card, bottom corner, on any dashboard page. */
export function IncomingCall({
  info,
  busy,
  onAccept,
  onDecline,
}: {
  info: CallInfo;
  /** Already in another call: you can only decline (or leave that one first). */
  busy: boolean;
  onAccept: (video: boolean) => void;
  onDecline: () => void;
}) {
  const { t } = useChatT();
  const caller = info.startedBy?.name ?? "—";
  const where = info.conversationType === "dm" ? null : info.conversationName;
  return (
    <div
      role="alertdialog"
      aria-label={info.video ? t("incomingVideoCall") : t("incomingCall")}
      className="fixed bottom-4 end-4 z-[70] w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 text-white shadow-2xl shadow-black/40"
      data-testid="incoming-call"
    >
      <div className="flex items-center gap-3 p-4">
        <span className="relative">
          <span className="absolute -inset-1 animate-ping rounded-xl bg-emerald-400/30" />
          <span className="relative block rounded-xl ring-2 ring-emerald-400">
            <Avatar name={caller} seed={info.startedBy?.id} size={48} />
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-emerald-300">{info.video ? t("incomingVideoCall") : t("incomingCall")}</p>
          <p className="truncate text-base font-bold">{caller}</p>
          {where && <p className="truncate text-xs text-slate-400">{where}</p>}
        </div>
      </div>
      <div className="flex gap-2 border-t border-white/10 bg-black/20 p-3">
        <button
          type="button"
          onClick={onDecline}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-rose-600 py-2 text-sm font-semibold hover:bg-rose-500"
          data-testid="call-decline"
        >
          <PhoneOff className="h-4 w-4" /> {t("decline")}
        </button>
        {!busy && (
          <>
            <button
              type="button"
              onClick={() => onAccept(false)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2 text-sm font-semibold hover:bg-emerald-500"
              data-testid="call-accept"
            >
              <Phone className="h-4 w-4" /> {t("accept")}
            </button>
            <button
              type="button"
              onClick={() => onAccept(true)}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/20"
              title={t("acceptVideo")}
            >
              <Video className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
