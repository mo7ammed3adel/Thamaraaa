"use client";

import { useState } from "react";
import { CheckCheck, Check, Download, FileArchive, FileText, File as FileIcon, MessageSquareText, Pencil, Pin, Reply, SmilePlus, Trash2, X } from "lucide-react";
import { attachmentUrl, type ChatAttachment, type ChatMessage } from "@/client/api/chat";
import { REACTION_EMOJIS, findSticker, formatBytes } from "@/lib/chat/constants";
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
    case "linked": return `${senderName} ${t("sys_linked")} «${arg}»`;
    case "unlinked": return `${senderName} ${t("sys_unlinked")}`;
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
  onOpenUser,
  onQuote,
  onJumpTo,
  showSenderNames = true,
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
  /** Tap a name/photo: open that person's card (message, call). */
  onOpenUser?: (user: { id: string; name: string; role?: string | null }, anchor: DOMRect) => void;
  /** WhatsApp-style reply to this message. */
  onQuote?: (m: ChatMessage) => void;
  /** Jump to a quoted message. */
  onJumpTo?: (id: string, threadRootId: string | null) => void;
  /** Group chats show who wrote each bubble; a DM doesn't need to. */
  showSenderNames?: boolean;
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
  const sender = message.sender;
  const canOpenUser = Boolean(onOpenUser && sender && sender.id !== meId);
  const openUser = (e: React.MouseEvent<HTMLElement>) => {
    if (sender && onOpenUser) onOpenUser({ id: sender.id, name: sender.name, role: sender.role }, e.currentTarget.getBoundingClientRect());
  };
  const mentionsMe = Boolean(message.body?.includes(`<@${meId}>`));
  // Stickers and call cards stand on their own, like in WhatsApp.
  const bare = !message.deleted && (message.kind === "sticker" || message.kind === "call") && !message.quote;
  const showName = !mine && !grouped && showSenderNames;

  const bubble = mine
    ? "bg-emerald-100/80 text-slate-900 ring-1 ring-emerald-200/70"
    : "bg-white text-slate-900 ring-1 ring-slate-200 shadow-sm";
  const tail = grouped ? "" : mine ? "rounded-se-md" : "rounded-ss-md";

  const time = (
    <span className={`ms-2 inline-flex translate-y-0.5 select-none items-center gap-0.5 whitespace-nowrap align-bottom text-[10.5px] ${mine ? "text-emerald-800/60" : "text-slate-400"}`}>
      {message.editedAt && <span>{t("edited")} ·</span>}
      {formatTime(message.createdAt, locale)}
      {mine && isLastMine && (seen ? <CheckCheck className="h-3.5 w-3.5 text-sky-500" aria-label={t("seen")} /> : <Check className="h-3.5 w-3.5" aria-label={t("sent")} />)}
    </span>
  );

  return (
    <div
      id={`msg-${message.id}`}
      className={`group relative flex items-end gap-2 px-3 transition-colors sm:px-4 ${grouped ? "py-[1px]" : "pt-2"} ${mine ? "flex-row-reverse" : ""} ${
        mentionsMe && !mine ? "bg-amber-50/50" : ""
      }`}
      data-mine={mine ? "1" : "0"}
      data-testid="message-row"
    >
      {/* Others: their photo beside the first message of a run. */}
      {!mine && (
        <div className="w-8 shrink-0 self-start pt-0.5">
          {!grouped &&
            (canOpenUser ? (
              <button type="button" onClick={openUser} className="block rounded-xl transition hover:opacity-80" aria-label={sender?.name ?? ""}>
                <Avatar name={sender?.name} seed={sender?.id} size={32} />
              </button>
            ) : (
              <Avatar name={sender?.name} seed={sender?.id} size={32} />
            ))}
        </div>
      )}

      <div className={`flex min-w-0 max-w-[85%] flex-col sm:max-w-[70%] ${mine ? "items-end" : "items-start"}`}>
        <div className={bare ? "" : `relative min-w-[4.5rem] max-w-full rounded-2xl px-3 py-1.5 ${bubble} ${tail} ${message.pinned ? "ring-2 ring-amber-300" : ""}`} data-testid="bubble">
          {showName && !bare && (
            canOpenUser ? (
              <button type="button" onClick={openUser} className="mb-0.5 block text-[13px] font-bold hover:underline" style={{ color: nameColor(sender?.id) }} data-testid="sender-name">
                {sender?.name}
              </button>
            ) : (
              <span className="mb-0.5 block text-[13px] font-bold" style={{ color: nameColor(sender?.id) }}>{sender?.name || "—"}</span>
            )
          )}
          {message.pinned && !message.deleted && (
            <div className="mb-0.5 flex items-center gap-1 text-[11px] font-medium text-amber-700">
              <Pin className="h-3 w-3" /> {t("pinned")}
            </div>
          )}

          {message.quote && !message.deleted && (
            <QuoteBlock quote={message.quote} mine={mine} meId={meId} names={names} onJump={onJumpTo} />
          )}

          {message.deleted ? (
            <p className="text-sm italic text-slate-400">
              {t("deleted")}
              {time}
            </p>
          ) : (
            <>
              {message.kind === "sticker" && message.stickerId && (
                <div className="py-1">
                  <Sticker id={message.stickerId} locale={locale} />
                </div>
              )}
              {message.kind === "call" && (
                <CallCard message={message} meId={meId} activeCallId={activeCallId} activeCount={activeCallCount} onJoin={(video) => onJoinCall?.(video)} />
              )}
              {isMedia && message.attachments[0] && (
                <div className="my-0.5">
                  <VoicePlayer attachment={message.attachments[0]} kind={message.kind as "voice" | "recording"} />
                </div>
              )}
              {!isMedia && message.attachments.length > 0 && (
                <div className="my-1 flex flex-wrap items-start gap-2">
                  {message.attachments.map((a) => (
                    <AttachmentView key={a.id} a={a} onOpenImage={onOpenImage} />
                  ))}
                </div>
              )}
              {message.body ? (
                <div className="whitespace-pre-wrap break-words text-[15px] leading-relaxed" dir="auto">
                  <Mrkdwn text={message.body} names={names} meId={meId} />
                  {time}
                </div>
              ) : (
                !bare && <div className="text-end">{time}</div>
              )}
              {bare && <div className={`mt-0.5 ${mine ? "text-end" : ""}`}>{time}</div>}
            </>
          )}
        </div>

        {message.reactions.length > 0 && (
          <div className={`-mt-1.5 flex flex-wrap gap-1 px-2 ${mine ? "justify-end" : ""}`}>
            {message.reactions.map((r) => (
              <button
                key={r.emoji}
                type="button"
                title={r.names.join("، ")}
                onClick={() => onReact(message, r.emoji)}
                className={`flex items-center gap-1 rounded-full border bg-white px-1.5 py-0.5 text-xs shadow-sm transition ${
                  r.mine ? "border-emerald-400 text-emerald-800" : "border-slate-200 text-slate-600 hover:border-slate-400"
                }`}
              >
                <span>{r.emoji}</span>
                {r.count > 1 && <span className="font-semibold">{r.count}</span>}
              </button>
            ))}
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
                  <Avatar name={p.name} seed={p.id} size={20} />
                </span>
              ))}
            </span>
            <span className="text-[12px] font-bold text-emerald-700 group-hover/t:underline">
              {message.thread.count} {message.thread.count === 1 ? t("reply1") : t("replies")}
            </span>
            <span className="text-[11px] text-slate-500 group-hover/t:hidden">
              {t("lastReply")} {relativeTime(message.thread.lastReplyAt, locale, t)}
            </span>
            <span className="hidden text-[11px] text-slate-500 group-hover/t:inline">{t("viewThread")}</span>
          </button>
        )}
      </div>

      {/* Hover actions, on the inner side of the bubble. */}
      {!message.deleted && (
        <div className={`relative mb-1 hidden shrink-0 items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-0.5 shadow-md group-hover:flex ${picker ? "!flex" : ""}`}>
          {onQuote && (
            <ActionButton title={t("reply")} onClick={() => onQuote(message)}>
              <Reply className="h-4 w-4" />
            </ActionButton>
          )}
          <div className="relative">
            <ActionButton title={t("react")} onClick={() => setPicker((v) => !v)}>
              <SmilePlus className="h-4 w-4" />
            </ActionButton>
            {picker && (
              <div className={`absolute bottom-9 z-20 flex gap-0.5 rounded-xl border border-slate-200 bg-white p-1 shadow-xl ${mine ? "end-0" : "start-0"}`} onMouseLeave={() => setPicker(false)}>
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

/** A stable, readable colour per person for names in group bubbles (WhatsApp). */
const NAME_COLORS = ["#0f766e", "#7c3aed", "#c2410c", "#0369a1", "#be185d", "#4d7c0f", "#b45309", "#1d4ed8", "#9333ea", "#0e7490"];
function nameColor(id: string | undefined) {
  let h = 0;
  for (const ch of id ?? "") h = (h * 31 + ch.charCodeAt(0)) | 0;
  return NAME_COLORS[Math.abs(h) % NAME_COLORS.length];
}

/** The quoted message above a reply; tap it to jump there. */
export function QuoteBlock({
  quote,
  mine,
  meId,
  names,
  onJump,
  onCancel,
}: {
  quote: NonNullable<ChatMessage["quote"]>;
  mine?: boolean;
  meId: string;
  names: Map<string, string>;
  onJump?: (id: string, threadRootId: string | null) => void;
  /** In the composer: remove the quote. */
  onCancel?: () => void;
}) {
  const { t, locale } = useChatT();
  const who = quote.senderId === meId ? t("you") : quote.senderName ?? "—";
  const preview = quote.deleted
    ? t("deleted")
    : quote.text
      ? quote.text.replace(/<@([0-9a-f-]{36})>/g, (_m, id: string) => `@${names.get(id) ?? "—"}`)
      : quote.kind === "sticker"
        ? `${findSticker(quote.stickerId)?.caption[locale] ?? ""} · ${t("sticker")}`
        : quote.kind === "voice"
          ? `🎤 ${t("voiceMessage")}`
          : quote.kind === "recording"
            ? `⏺ ${t("callRecording")}`
            : quote.kind === "call"
              ? `📞 ${t("audioCall")}`
              : quote.attachment
                ? `${quote.attachment.category === "image" ? "📷" : quote.attachment.category === "video" ? "🎬" : "📎"} ${quote.attachment.originalName}`
                : "";
  const Tag = onJump && !onCancel ? "button" : "div";
  return (
    <Tag
      {...(Tag === "button" ? { type: "button" as const, onClick: () => onJump?.(quote.id, quote.threadRootId) } : {})}
      className={`mb-1 flex w-full min-w-0 items-stretch overflow-hidden rounded-lg text-start ${mine ? "bg-emerald-900/5" : "bg-slate-100"} ${Tag === "button" ? "hover:brightness-95" : ""}`}
      data-testid="quote-block"
    >
      <span className="w-1 shrink-0" style={{ background: nameColor(quote.senderId ?? undefined) }} />
      <span className="min-w-0 flex-1 px-2 py-1">
        <span className="block truncate text-[12px] font-bold" style={{ color: nameColor(quote.senderId ?? undefined) }}>{who}</span>
        <span className="line-clamp-2 block break-words text-[12.5px] text-slate-600" dir="auto">{preview}</span>
      </span>
      {onCancel && (
        <button type="button" onClick={onCancel} className="self-center rounded-full p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700" aria-label={t("cancel")} data-testid="quote-cancel">
          <X className="h-4 w-4" />
        </button>
      )}
    </Tag>
  );
}
