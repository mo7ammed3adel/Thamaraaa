"use client";

import { useState } from "react";
import { CheckCheck, Check, Download, FileArchive, FileText, File as FileIcon, MessageSquareText, Pencil, Pin, SmilePlus, Trash2, X } from "lucide-react";
import { attachmentUrl, type ChatAttachment, type ChatMessage } from "@/client/api/chat";
import { REACTION_EMOJIS, formatBytes } from "@/lib/chat/constants";
import { Avatar, Sticker } from "./ChatBits";
import { Mrkdwn } from "./mrkdwn";
import { useChatT } from "./useChatT";
import { CallCard, VoicePlayer } from "./MediaBits";

function AttachmentView({ a, onOpenImage }: { a: ChatAttachment; onOpenImage: (a: ChatAttachment) => void }) {
  const { t } = useChatT();
  if (a.category === "image") {
    return (
      <button type="button" onClick={() => onOpenImage(a)} className="group/img block overflow-hidden rounded-lg ring-1 ring-slate-200">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={attachmentUrl(a.id)} alt={a.originalName} loading="lazy" className="max-h-72 max-w-full object-cover transition group-hover/img:scale-[1.02]" />
      </button>
    );
  }
  if (a.category === "video") {
    return <video src={attachmentUrl(a.id)} controls preload="metadata" className="max-h-80 max-w-full rounded-lg bg-black ring-1 ring-slate-200" />;
  }
  if (a.category === "audio") {
    return <audio src={attachmentUrl(a.id)} controls preload="metadata" className="w-72 max-w-full" />;
  }
  const Icon = a.category === "pdf" || a.category === "document" ? FileText : a.category === "archive" ? FileArchive : FileIcon;
  const tone = a.category === "pdf" ? "from-rose-500 to-red-600" : a.category === "archive" ? "from-amber-500 to-orange-600" : "from-sky-500 to-indigo-600";
  return (
    <div className="flex w-72 max-w-full items-center gap-3 rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${tone} text-white`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-800" title={a.originalName}>{a.originalName}</p>
        <p className="text-xs text-slate-500">{formatBytes(a.size)}</p>
      </div>
      {a.category === "pdf" && (
        <a href={attachmentUrl(a.id)} target="_blank" rel="noopener noreferrer" className="rounded-md px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50">
          {t("open")}
        </a>
      )}
      <a href={attachmentUrl(a.id, true)} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800" aria-label={t("download")}>
        <Download className="h-4 w-4" />
      </a>
    </div>
  );
}

export function ImageLightbox({ attachment, onClose }: { attachment: ChatAttachment; onClose: () => void }) {
  const { t } = useChatT();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-6 backdrop-blur" onClick={onClose}>
      <div className="absolute end-4 top-4 flex gap-2">
        <a href={attachmentUrl(attachment.id, true)} onClick={(e) => e.stopPropagation()} className="rounded-full bg-white/10 p-2.5 text-white hover:bg-white/20" aria-label={t("download")}>
          <Download className="h-5 w-5" />
        </a>
        <button onClick={onClose} className="rounded-full bg-white/10 p-2.5 text-white hover:bg-white/20" aria-label={t("cancel")}>
          <X className="h-5 w-5" />
        </button>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={attachmentUrl(attachment.id)} alt={attachment.originalName} className="max-h-full max-w-full rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
    </div>
  );
}

/** Wraps text in a bidi isolate so a Latin name cannot reorder the Arabic around it. */
const iso = (s: string) => `⁨${s}⁩`;

function systemText(body: string, rawSender: string, t: ReturnType<typeof useChatT>["t"]): string {
  const sep = body.indexOf(":");
  const kind = sep >= 0 ? body.slice(0, sep) : body;
  const arg = iso(sep >= 0 ? body.slice(sep + 1) : "");
  const senderName = iso(rawSender);
  switch (kind) {
    case "created": return `${senderName} ${t("sys_created")} «${arg}»`;
    case "renamed": return `${senderName} ${t("sys_renamed")} «${arg}»`;
    case "added": return `${senderName} ${t("sys_added")} ${arg}`;
    case "removed": return `${senderName} ${t("sys_removed")} ${arg}`;
    case "left": return `${arg} ${t("sys_left")}`;
    case "joined": return `${arg} ${t("sys_joined")}`;
    default: return body;
  }
}

export function formatTime(iso: string, locale: string) {
  return new Date(iso).toLocaleTimeString(locale === "ar" ? "ar-EG" : "en-US", { hour: "numeric", minute: "2-digit" });
}

function relativeTime(iso: string, locale: string, t: ReturnType<typeof useChatT>["t"]) {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return `${t("today")} ${formatTime(iso, locale)}`;
  return d.toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US", { day: "numeric", month: "short" });
}

function ActionButton({ title, onClick, children, danger }: { title: string; onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`rounded-md p-1.5 text-slate-500 hover:bg-slate-100 ${danger ? "hover:text-rose-600" : "hover:text-slate-800"}`}
    >
      {children}
    </button>
  );
}

export default function MessageItem({
  message,
  meId,
  names,
  grouped,
  canModerate,
  seen,
  isLastMine,
  inThread,
  onOpenThread,
  onEdit,
  onDelete,
  onReact,
  onPin,
  onOpenImage,
  activeCallId = null,
  activeCallCount = 0,
  onJoinCall,
}: {
  message: ChatMessage;
  meId: string;
  /** userId → name, for rendering @mentions. */
  names: Map<string, string>;
  grouped: boolean;
  canModerate: boolean;
  seen?: boolean;
  isLastMine?: boolean;
  /** Rendered inside a thread panel: no "reply in thread" or thread summary. */
  inThread?: boolean;
  onOpenThread: (m: ChatMessage) => void;
  onEdit: (m: ChatMessage) => void;
  onDelete: (m: ChatMessage) => void;
  onReact: (m: ChatMessage, emoji: string) => void;
  onPin: (m: ChatMessage) => void;
  onOpenImage: (a: ChatAttachment) => void;
  /** The conversation's live call, so its card offers "Join". */
  activeCallId?: string | null;
  activeCallCount?: number;
  onJoinCall?: (video: boolean) => void;
}) {
  const { t, locale } = useChatT();
  const [picker, setPicker] = useState(false);
  const mine = message.sender?.id === meId;

  if (message.kind === "system") {
    return (
      <div className="my-3 flex justify-center">
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
          {systemText(message.body || "", message.sender?.name || "—", t)}
        </span>
      </div>
    );
  }

  const canEdit = mine && message.kind === "text" && !message.deleted;
  const canDelete = !message.deleted && message.kind !== "call" && (mine || canModerate);
  const isMedia = message.kind === "voice" || message.kind === "recording";
  const mentionsMe = Boolean(message.body?.includes(`<@${meId}>`));

  return (
    <div
      id={`msg-${message.id}`}
      className={`group relative flex gap-2.5 px-4 transition-colors hover:bg-slate-50 ${grouped ? "py-0.5" : "mt-1 pb-0.5 pt-2"} ${
        message.pinned ? "bg-amber-50/60 hover:bg-amber-50" : mentionsMe ? "border-s-2 border-amber-400 bg-amber-50/40" : ""
      }`}
    >
      <div className="w-9 shrink-0 pt-0.5">
        {grouped ? (
          <span className="invisible block pt-1 text-center text-[10px] text-slate-400 group-hover:visible">{formatTime(message.createdAt, locale)}</span>
        ) : (
          <Avatar name={message.sender?.name} seed={message.sender?.id} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        {message.pinned && !message.deleted && (
          <div className="mb-0.5 flex items-center gap-1 text-[11px] font-medium text-amber-700">
            <Pin className="h-3 w-3" /> {t("pinned")}
          </div>
        )}
        {!grouped && (
          <div className="flex items-baseline gap-2">
            <span className="text-[15px] font-bold text-slate-900">{message.sender?.name || "—"}</span>
            <span className="text-[11px] text-slate-500">{formatTime(message.createdAt, locale)}</span>
          </div>
        )}

        {message.deleted ? (
          <p className="text-sm italic text-slate-400">{t("deleted")}</p>
        ) : (
          <>
            {message.kind === "sticker" && message.stickerId && (
              <div className="py-2">
                <Sticker id={message.stickerId} locale={locale} />
              </div>
            )}
            {message.body && (
              <div className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-slate-800" dir="auto">
                <Mrkdwn text={message.body} names={names} meId={meId} />
                {message.editedAt && <span className="ms-1.5 text-[11px] text-slate-400">({t("edited")})</span>}
              </div>
            )}
            {message.kind === "call" && (
              <CallCard message={message} meId={meId} activeCallId={activeCallId} activeCount={activeCallCount} onJoin={(video) => onJoinCall?.(video)} />
            )}
            {isMedia && message.attachments[0] && (
              <div className="mt-1">
                <VoicePlayer attachment={message.attachments[0]} kind={message.kind as "voice" | "recording"} />
              </div>
            )}
            {!isMedia && message.attachments.length > 0 && (
              <div className="mt-1.5 flex flex-wrap items-start gap-2">
                {message.attachments.map((a) => (
                  <AttachmentView key={a.id} a={a} onOpenImage={onOpenImage} />
                ))}
              </div>
            )}
          </>
        )}

        {message.reactions.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {message.reactions.map((r) => (
              <button
                key={r.emoji}
                type="button"
                title={r.names.join("، ")}
                onClick={() => onReact(message, r.emoji)}
                className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition ${
                  r.mine ? "border-emerald-400 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-400"
                }`}
              >
                <span>{r.emoji}</span>
                <span className="font-semibold">{r.count}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPicker((v) => !v)}
              className="flex items-center rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-slate-500 opacity-0 transition hover:border-slate-400 group-hover:opacity-100"
              title={t("react")}
            >
              <SmilePlus className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {!inThread && message.thread && (
          <button
            type="button"
            onClick={() => onOpenThread(message)}
            className="group/t mt-1 flex items-center gap-2 rounded-lg border border-transparent px-1.5 py-1 text-start hover:border-slate-200 hover:bg-white"
          >
            <span className="flex -space-x-1.5 rtl:space-x-reverse">
              {message.thread.participants.map((p) => (
                <span key={p.id} className="rounded-md ring-2 ring-white">
                  <Avatar name={p.name} seed={p.id} size={22} />
                </span>
              ))}
            </span>
            <span className="text-[13px] font-bold text-emerald-700 group-hover/t:underline">
              {message.thread.count} {message.thread.count === 1 ? t("reply1") : t("replies")}
            </span>
            <span className="text-[12px] text-slate-500 group-hover/t:hidden">
              {t("lastReply")} {relativeTime(message.thread.lastReplyAt, locale, t)}
            </span>
            <span className="hidden text-[12px] text-slate-500 group-hover/t:inline">{t("viewThread")}</span>
          </button>
        )}

        {isLastMine && (
          <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400">
            {seen ? <CheckCheck className="h-3.5 w-3.5 text-emerald-500" /> : <Check className="h-3.5 w-3.5" />}
            {seen ? t("seen") : t("sent")}
          </div>
        )}
      </div>

      {!message.deleted && (
        <div className="absolute -top-4 end-4 z-10 hidden items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-0.5 shadow-md group-hover:flex">
          <div className="relative">
            <ActionButton title={t("react")} onClick={() => setPicker((v) => !v)}>
              <SmilePlus className="h-4 w-4" />
            </ActionButton>
            {picker && (
              <div className="absolute end-0 top-9 z-20 flex gap-0.5 rounded-xl border border-slate-200 bg-white p-1 shadow-xl" onMouseLeave={() => setPicker(false)}>
                {REACTION_EMOJIS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    className="rounded-lg p-1 text-lg transition hover:scale-125 hover:bg-slate-100"
                    onClick={() => {
                      setPicker(false);
                      onReact(message, e);
                    }}
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>
          {!inThread && (
            <ActionButton title={t("replyInThread")} onClick={() => onOpenThread(message)}>
              <MessageSquareText className="h-4 w-4" />
            </ActionButton>
          )}
          <ActionButton title={message.pinned ? t("unpin") : t("pin")} onClick={() => onPin(message)}>
            <Pin className={`h-4 w-4 ${message.pinned ? "fill-amber-400 text-amber-600" : ""}`} />
          </ActionButton>
          {canEdit && (
            <ActionButton title={t("edit")} onClick={() => onEdit(message)}>
              <Pencil className="h-4 w-4" />
            </ActionButton>
          )}
          {canDelete && (
            <ActionButton title={t("delete")} onClick={() => onDelete(message)} danger>
              <Trash2 className="h-4 w-4" />
            </ActionButton>
          )}
        </div>
      )}
    </div>
  );
}
