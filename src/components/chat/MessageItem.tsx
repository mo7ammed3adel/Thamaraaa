"use client";

import { Fragment, useState } from "react";
import { CheckCheck, Check, Download, FileArchive, FileText, File as FileIcon, Pencil, Reply, SmilePlus, Trash2, X } from "lucide-react";
import { attachmentUrl, type ChatAttachment, type ChatMessage } from "@/client/api/chat";
import { REACTION_EMOJIS, formatBytes } from "@/lib/chat/constants";
import { normalizeWebUrl } from "@/lib/safe-url";
import { Avatar, Sticker } from "./ChatBits";
import { useChatT } from "./useChatT";

const URL_PATTERN = /(https?:\/\/[^\s<>"]+)/g;

/** Renders text with http(s) links made clickable. Anything else stays text. */
function RichText({ text }: { text: string }) {
  const parts = text.split(URL_PATTERN);
  return (
    <>
      {parts.map((part, i) => {
        if (i % 2 === 1) {
          const trimmed = part.replace(/[.,!?؟،)\]]+$/, "");
          const rest = part.slice(trimmed.length);
          const safe = normalizeWebUrl(trimmed);
          if (safe) {
            return (
              <Fragment key={i}>
                <a href={safe} target="_blank" rel="noopener noreferrer nofollow" dir="ltr" className="font-medium text-emerald-700 [overflow-wrap:anywhere] [unicode-bidi:isolate] underline decoration-emerald-300 underline-offset-2 hover:text-emerald-900">
                  {trimmed}
                </a>
                {rest}
              </Fragment>
            );
          }
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}

function AttachmentView({ a, onOpenImage }: { a: ChatAttachment; onOpenImage: (a: ChatAttachment) => void }) {
  const { t } = useChatT();
  if (a.category === "image") {
    return (
      <button type="button" onClick={() => onOpenImage(a)} className="group/img block overflow-hidden rounded-xl ring-1 ring-slate-200">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={attachmentUrl(a.id)} alt={a.originalName} loading="lazy" className="max-h-72 max-w-full object-cover transition group-hover/img:scale-[1.02]" />
      </button>
    );
  }
  if (a.category === "video") {
    return <video src={attachmentUrl(a.id)} controls preload="metadata" className="max-h-80 max-w-full rounded-xl bg-black ring-1 ring-slate-200" />;
  }
  if (a.category === "audio") {
    return <audio src={attachmentUrl(a.id)} controls preload="metadata" className="w-72 max-w-full" />;
  }
  const Icon = a.category === "pdf" || a.category === "document" ? FileText : a.category === "archive" ? FileArchive : FileIcon;
  const tone = a.category === "pdf" ? "from-rose-500 to-red-600" : a.category === "archive" ? "from-amber-500 to-orange-600" : "from-sky-500 to-indigo-600";
  return (
    <div className="flex w-72 max-w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
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

export default function MessageItem({
  message,
  meId,
  grouped,
  canModerate,
  seen,
  isLastMine,
  onReply,
  onEdit,
  onDelete,
  onReact,
  onOpenImage,
  onJumpTo,
}: {
  message: ChatMessage;
  meId: string;
  grouped: boolean;
  canModerate: boolean;
  seen: boolean;
  isLastMine: boolean;
  onReply: (m: ChatMessage) => void;
  onEdit: (m: ChatMessage) => void;
  onDelete: (m: ChatMessage) => void;
  onReact: (m: ChatMessage, emoji: string) => void;
  onOpenImage: (a: ChatAttachment) => void;
  onJumpTo: (id: string) => void;
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
  const canDelete = !message.deleted && (mine || canModerate);

  return (
    <div id={`msg-${message.id}`} className={`group relative flex gap-3 rounded-xl px-3 transition-colors hover:bg-slate-50 ${grouped ? "py-0.5" : "mt-3 pt-2 pb-0.5"}`}>
      <div className="w-9 shrink-0">{!grouped && <Avatar name={message.sender?.name} seed={message.sender?.id} />}</div>
      <div className="min-w-0 flex-1">
        {!grouped && (
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold text-slate-900">{mine ? t("you") : message.sender?.name || "—"}</span>
            <span className="text-[11px] text-slate-400">{formatTime(message.createdAt, locale)}</span>
          </div>
        )}

        {message.replyTo && !message.deleted && (
          <button
            type="button"
            onClick={() => onJumpTo(message.replyTo!.id)}
            className="mb-1 mt-0.5 flex max-w-md items-start gap-2 rounded-lg border-s-4 border-emerald-400 bg-emerald-50/70 px-3 py-1.5 text-start text-xs text-slate-600 hover:bg-emerald-50"
          >
            <Reply className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
            <span className="min-w-0">
              <span className="font-semibold text-emerald-800">{message.replyTo.senderName}</span>{" "}
              <span className="line-clamp-1">
                {message.replyTo.deleted ? t("deleted") : message.replyTo.body || (message.replyTo.kind === "sticker" ? t("sticker") : t("attachment"))}
              </span>
            </span>
          </button>
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
              <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-slate-800" dir="auto">
                <RichText text={message.body} />
                {message.editedAt && <span className="ms-1.5 text-[11px] text-slate-400">({t("edited")})</span>}
              </p>
            )}
            {message.attachments.length > 0 && (
              <div className="mt-1.5 flex flex-wrap items-start gap-2">
                {message.attachments.map((a) => (
                  <AttachmentView key={a.id} a={a} onOpenImage={onOpenImage} />
                ))}
              </div>
            )}
          </>
        )}

        {message.reactions.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {message.reactions.map((r) => (
              <button
                key={r.emoji}
                type="button"
                title={r.names.join("، ")}
                onClick={() => onReact(message, r.emoji)}
                className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition ${
                  r.mine ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                <span>{r.emoji}</span>
                <span className="font-semibold">{r.count}</span>
              </button>
            ))}
          </div>
        )}

        {isLastMine && (
          <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400">
            {seen ? <CheckCheck className="h-3.5 w-3.5 text-emerald-500" /> : <Check className="h-3.5 w-3.5" />}
            {seen ? t("seen") : t("sent")}
          </div>
        )}
      </div>

      {!message.deleted && (
        <div className="absolute -top-3 end-3 hidden items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-0.5 shadow-md group-hover:flex">
          <div className="relative">
            <button type="button" onClick={() => setPicker((v) => !v)} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800" title={t("react")}>
              <SmilePlus className="h-4 w-4" />
            </button>
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
          <button type="button" onClick={() => onReply(message)} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800" title={t("reply")}>
            <Reply className="h-4 w-4" />
          </button>
          {canEdit && (
            <button type="button" onClick={() => onEdit(message)} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800" title={t("edit")}>
              <Pencil className="h-4 w-4" />
            </button>
          )}
          {canDelete && (
            <button type="button" onClick={() => onDelete(message)} className="rounded-md p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600" title={t("delete")}>
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
