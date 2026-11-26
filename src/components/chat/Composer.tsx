"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AtSign, Bold, Code, FileText, Italic, Mic, Paperclip, Pencil, SendHorizontal, ShieldCheck, Smile, SquareCode, Sticker as StickerIcon, Strikethrough, Trash2, X } from "lucide-react";
import { MAX_FILES_PER_MESSAGE, MAX_FILE_BYTES, MAX_MESSAGE_LENGTH, STICKERS, formatBytes } from "@/lib/chat/constants";
import type { ChatMessage } from "@/client/api/chat";
import { Avatar, Sticker } from "./ChatBits";
import { QuoteBlock } from "./MessageItem";
import { useChatT } from "./useChatT";
import { MAX_VOICE_MS, VOICE_BITRATE, formatDuration } from "@/lib/chat/media";
import { recordAudio, stampedName, type AudioRecording, type RecordingResult } from "@/lib/chat/recorder";

export type ComposerSubmit =
  | { kind: "text"; body: string; files: File[] }
  | { kind: "sticker"; stickerId: string }
  | { kind: "edit"; id: string; body: string }
  | { kind: "voice"; file: File; durationMs: number; waveform: string };

export type MentionMember = { userId: string; name: string; role?: string };

const EMOJIS = [
  "😀", "😂", "🤣", "😊", "😍", "😎", "🤔", "😅", "😭", "😡", "🥳", "😴",
  "👍", "👎", "👏", "🙏", "💪", "👀", "🙌", "🤝", "✌️", "👌", "🫡", "🤷",
  "❤️", "🔥", "✨", "🎉", "✅", "❌", "⚠️", "📌", "📎", "📅", "💰", "🚀",
  "☕", "🍕", "🌙", "☀️", "💡", "📞", "📈", "🏆",
];

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * "@Name" in the editor → "<@id>" on the wire. Only names actually picked from
 * the suggestion list (or decoded from the message being edited) are encoded,
 * only as whole words ("@Alia" never becomes Ali), and never inside code.
 */
function encodeMentions(text: string, picked: Map<string, string>): string {
  const labels = Array.from(picked.keys()).sort((a, b) => b.length - a.length);
  if (labels.length === 0) return text;
  return text
    .split(/(```[\s\S]*?```|`[^`\n]*`)/g)
    .map((part, i) => {
      if (i % 2 === 1) return part;
      let out = part;
      for (const label of labels) {
        const re = new RegExp(`(^|[^\\p{L}\\p{N}_@.])@${escapeRegExp(label)}(?=$|[\\s.,!?؟،:;)\\]])`, "gu");
        out = out.replace(re, (_m, pre: string) => `${pre}<@${picked.get(label)}>`);
      }
      return out;
    })
    .join("");
}

/** "<@id>" → "@Name" for editing; known ids are remembered so they encode back. */
function decodeMentions(text: string, names: Map<string, string>, picked: Map<string, string>): string {
  return text.replace(/<@([0-9a-f-]{36})>/g, (token, id: string) => {
    const name = names.get(id);
    if (!name) return token; // ex-member: keep the token so the mention survives the edit
    picked.set(name, id);
    return `@${name}`;
  });
}

function ToolButton({ title, onClick, children, active, disabled }: { title: string; onClick: () => void; children: React.ReactNode; active?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()} // keep the textarea selection
      onClick={onClick}
      className={`rounded-md p-1.5 transition hover:bg-slate-200 hover:text-slate-800 disabled:opacity-40 ${active ? "bg-slate-200 text-slate-800" : "text-slate-500"}`}
    >
      {children}
    </button>
  );
}

export default function Composer({
  disabled,
  editing,
  uploadProgress,
  members,
  names,
  placeholder,
  compact,
  onCancelEdit,
  onSubmit,
  onError,
  quoting,
  onCancelQuote,
  meId,
}: {
  disabled?: boolean;
  editing: ChatMessage | null;
  uploadProgress: number | null;
  members: MentionMember[];
  /** Every current member's name (including you), for decoding an edited message. */
  names: Map<string, string>;
  placeholder: string;
  /** Thread panel: smaller, no stickers. */
  compact?: boolean;
  onCancelEdit: () => void;
  onSubmit: (input: ComposerSubmit) => Promise<boolean>;
  onError: (message: string) => void;
  /** Replying to this message (WhatsApp-style); shown above the input. */
  quoting?: ChatMessage | null;
  onCancelQuote?: () => void;
  meId?: string;
}) {
  const { t, locale } = useChatT();
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [popover, setPopover] = useState<"stickers" | "emoji" | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  /** label → userId for mentions picked in this draft. */
  const picked = useRef(new Map<string, string>());
  const [voice, setVoice] = useState<{ rec: AudioRecording; stream: MediaStream } | null>(null);
  const voiceRef = useRef(voice);
  voiceRef.current = voice;
  const [voiceTick, setVoiceTick] = useState<{ ms: number; levels: number[] }>({ ms: 0, levels: [] });
  const startingVoice = useRef(false);
  /** A voice note whose send failed: kept so it can be retried, not lost. */
  const [unsentVoice, setUnsentVoice] = useState<RecordingResult | null>(null);

  // Leaving the conversation mid-recording throws the recording away and
  // releases the microphone.
  useEffect(
    () => () => {
      const v = voiceRef.current;
      if (v) {
        v.rec.cancel();
        v.stream.getTracks().forEach((tr) => tr.stop());
      }
    },
    []
  );

  useEffect(() => {
    if (!voice) return;
    const handle = setInterval(() => {
      setVoiceTick((cur) => ({ ms: voice.rec.elapsedMs(), levels: [...cur.levels, voice.rec.level()].slice(-40) }));
    }, 100);
    return () => clearInterval(handle);
  }, [voice]);

  async function startVoice() {
    if (voice || startingVoice.current || disabled) return;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      onError(t("recordingUnsupported"));
      return;
    }
    startingVoice.current = true;
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      const rec = recordAudio(stream, {
        bitrate: VOICE_BITRATE,
        fileName: stampedName("voice"),
        maxMs: MAX_VOICE_MS,
        onLimit: () => finishVoice(),
      });
      setVoiceTick({ ms: 0, levels: [] });
      setVoice({ rec, stream });
    } catch (e) {
      stream?.getTracks().forEach((tr) => tr.stop());
      const name = e instanceof DOMException ? e.name : "";
      onError(name === "NotAllowedError" || name === "SecurityError" ? t("micDenied") : t("recordingUnsupported"));
    } finally {
      startingVoice.current = false;
    }
  }

  function cancelVoice() {
    const v = voiceRef.current;
    if (!v) return;
    v.rec.cancel();
    v.stream.getTracks().forEach((tr) => tr.stop());
    setVoice(null);
  }

  async function finishVoice() {
    const v = voiceRef.current;
    if (!v) return;
    voiceRef.current = null;
    setVoice(null);
    const result = await v.rec.stop();
    v.stream.getTracks().forEach((tr) => tr.stop());
    if (!result) {
      onError(t("voiceTooShort"));
      return;
    }
    await sendVoice(result);
  }

  async function sendVoice(result: RecordingResult) {
    setBusy(true);
    let ok = false;
    try {
      ok = await onSubmit({ kind: "voice", ...result });
    } finally {
      setBusy(false);
    }
    setUnsentVoice(ok ? null : result);
  }

  useEffect(() => {
    if (editing) {
      picked.current = new Map();
      setText(decodeMentions(editing.body || "", names, picked.current));
      setFiles([]);
      inputRef.current?.focus();
    }
    // names only matter at the moment editing starts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  useEffect(() => {
    if (quoting) inputRef.current?.focus();
  }, [quoting]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [text]);

  const suggestions = useMemo(() => {
    if (!mention) return [];
    const q = mention.query.toLowerCase();
    return members.filter((m) => m.name.toLowerCase().includes(q)).slice(0, 8);
  }, [mention, members]);

  function detectMention(value: string, caret: number) {
    const before = value.slice(0, caret);
    const match = /(^|\s)@([^\s@]{0,30})$/.exec(before);
    if (match) {
      setMention({ start: caret - match[2].length - 1, query: match[2] });
      setMentionIndex(0);
    } else setMention(null);
  }

  function pickMention(m: MentionMember) {
    if (!mention) return;
    const el = inputRef.current;
    const caret = el?.selectionStart ?? text.length;
    picked.current.set(m.name, m.userId);
    const insert = `@${m.name} `;
    const next = text.slice(0, mention.start) + insert + text.slice(caret);
    setText(next);
    setMention(null);
    requestAnimationFrame(() => {
      const pos = mention.start + insert.length;
      el?.focus();
      el?.setSelectionRange(pos, pos);
    });
  }

  /** Wraps the selection (or inserts a pair at the caret) with a format marker. */
  function wrap(marker: string, block = false) {
    const el = inputRef.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const open = block ? "```\n" : marker;
    const close = block ? "\n```" : marker;
    const selected = text.slice(s, e);
    const next = text.slice(0, s) + open + selected + close + text.slice(e);
    setText(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + open.length, s + open.length + selected.length);
    });
  }

  function insertAtCaret(value: string) {
    const el = inputRef.current;
    const s = el?.selectionStart ?? text.length;
    const e = el?.selectionEnd ?? text.length;
    setText(text.slice(0, s) + value + text.slice(e));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(s + value.length, s + value.length);
    });
  }

  function addFiles(list: FileList | File[]) {
    const incoming = Array.from(list);
    const tooBig = incoming.find((f) => f.size > MAX_FILE_BYTES);
    if (tooBig) onError(`${tooBig.name} ${t("fileTooLarge")}`);
    const ok = incoming.filter((f) => f.size <= MAX_FILE_BYTES && f.size > 0);
    setFiles((prev) => {
      const next = [...prev, ...ok];
      if (next.length > MAX_FILES_PER_MESSAGE) onError(t("tooManyFiles"));
      return next.slice(0, MAX_FILES_PER_MESSAGE);
    });
  }

  async function submit() {
    if (busy || disabled) return;
    const body = encodeMentions(text.trim(), picked.current);
    // Tokens are longer than "@Name", so check the length that is actually sent.
    if (body.length > MAX_MESSAGE_LENGTH) {
      onError(t("messageTooLong"));
      return;
    }
    if (editing) {
      if (!body) return;
      setBusy(true);
      const ok = await onSubmit({ kind: "edit", id: editing.id, body });
      setBusy(false);
      if (ok) {
        setText("");
        picked.current = new Map();
      }
      return;
    }
    if (!body && files.length === 0) return;
    setBusy(true);
    const ok = await onSubmit({ kind: "text", body, files });
    setBusy(false);
    if (ok) {
      setText("");
      setFiles([]);
      picked.current = new Map();
    }
    inputRef.current?.focus();
  }

  async function sendSticker(stickerId: string) {
    setPopover(null);
    setBusy(true);
    await onSubmit({ kind: "sticker", stickerId });
    setBusy(false);
  }

  return (
    <div
      className={`relative bg-white ${compact ? "px-3 pb-3 pt-2" : "px-4 pb-4 pt-2"}`}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setDragging(true);
        }
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!editing && e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
      }}
    >
      {dragging && (
        <div className="pointer-events-none absolute inset-2 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-emerald-400 bg-emerald-50/90 text-sm font-semibold text-emerald-700">
          {t("dropFiles")}
        </div>
      )}

      {editing && (
        <div className="mb-2 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-800 ring-1 ring-amber-200">
          <Pencil className="h-3.5 w-3.5" />
          <span className="font-semibold">{t("editing")}</span>
          <button
            type="button"
            className="ms-auto rounded p-1 hover:bg-amber-100"
            onClick={() => {
              onCancelEdit();
              setText("");
            }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {quoting && !editing && (
        <div className="mb-2">
          <QuoteBlock
            quote={{
              id: quoting.id,
              senderId: quoting.sender?.id ?? null,
              senderName: quoting.sender?.name ?? null,
              kind: quoting.kind,
              deleted: quoting.deleted,
              text: quoting.body,
              stickerId: quoting.stickerId,
              attachment: quoting.attachments[0] ? { category: quoting.attachments[0].category, originalName: quoting.attachments[0].originalName } : null,
              threadRootId: quoting.threadRootId,
            }}
            meId={meId ?? ""}
            names={names}
            onCancel={onCancelQuote}
          />
        </div>
      )}

      {uploadProgress !== null && (
        <div className="mb-2">
          <div className="mb-1 text-xs text-slate-500">
            {t("uploading")} {Math.round(uploadProgress * 100)}%
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 transition-all" style={{ width: `${uploadProgress * 100}%` }} />
          </div>
        </div>
      )}

      <div className="relative rounded-xl border border-slate-300 bg-white shadow-sm transition focus-within:border-slate-400 focus-within:shadow-md">
        {/* Mention suggestions */}
        {mention && suggestions.length > 0 && (
          <div className="absolute bottom-full start-0 z-30 mb-2 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-2xl">
            <div className="px-3 pb-1 pt-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">{t("members")}</div>
            {suggestions.map((m, i) => (
              <button
                key={m.userId}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pickMention(m)}
                className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-start text-sm ${i === mentionIndex ? "bg-emerald-600 text-white" : "text-slate-700 hover:bg-slate-50"}`}
              >
                <Avatar name={m.name} seed={m.userId} size={24} />
                <span className="font-semibold">{m.name}</span>
                {m.role && <span className={`truncate text-xs capitalize ${i === mentionIndex ? "text-emerald-100" : "text-slate-400"}`}>{m.role.replace(/_/g, " ")}</span>}
              </button>
            ))}
          </div>
        )}

        {/* Formatting toolbar */}
        <div className="flex items-center gap-0.5 border-b border-slate-100 px-1.5 py-1">
          <ToolButton title={t("fmtBold")} onClick={() => wrap("*")} disabled={disabled}><Bold className="h-4 w-4" /></ToolButton>
          <ToolButton title={t("fmtItalic")} onClick={() => wrap("_")} disabled={disabled}><Italic className="h-4 w-4" /></ToolButton>
          <ToolButton title={t("fmtStrike")} onClick={() => wrap("~")} disabled={disabled}><Strikethrough className="h-4 w-4" /></ToolButton>
          <span className="mx-1 h-4 w-px bg-slate-200" />
          <ToolButton title={t("fmtCode")} onClick={() => wrap("`")} disabled={disabled}><Code className="h-4 w-4" /></ToolButton>
          <ToolButton title={t("fmtCodeBlock")} onClick={() => wrap("", true)} disabled={disabled}><SquareCode className="h-4 w-4" /></ToolButton>
        </div>

        {files.length > 0 && (
          <div className="flex flex-wrap gap-2 px-3 pt-2">
            {files.map((f, i) => (
              <div key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 py-1.5 pe-1.5 ps-2.5 text-xs text-slate-700">
                <FileText className="h-3.5 w-3.5 text-slate-500" />
                <span className="max-w-[160px] truncate">{f.name}</span>
                <span className="text-slate-400">{formatBytes(f.size)}</span>
                <button type="button" onClick={() => setFiles((p) => p.filter((_, j) => j !== i))} className="rounded p-0.5 hover:bg-slate-200">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {unsentVoice && !voice && (
          <div className="flex items-center gap-2 border-b border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700" data-testid="voice-unsent">
            <Mic className="h-3.5 w-3.5" />
            <span className="flex-1">
              {t("voiceSendFailed")} · {formatDuration(unsentVoice.durationMs)}
            </span>
            <button type="button" disabled={busy} onClick={() => sendVoice(unsentVoice)} className="rounded-md bg-rose-600 px-2 py-1 font-semibold text-white hover:bg-rose-700 disabled:opacity-50">
              {t("retry")}
            </button>
            <button type="button" onClick={() => setUnsentVoice(null)} className="rounded-md p-1 hover:bg-rose-100" title={t("cancelRecording")}>
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {voice && (
          <div className="flex items-center gap-3 px-3 py-3" data-testid="voice-recorder">
            <button type="button" onClick={cancelVoice} title={t("cancelRecording")} className="rounded-full p-2 text-slate-500 transition hover:bg-rose-50 hover:text-rose-600">
              <Trash2 className="h-5 w-5" />
            </button>
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-500" />
            </span>
            <span className="w-12 font-mono text-sm tabular-nums text-slate-700">{formatDuration(voiceTick.ms)}</span>
            <div className="flex h-8 flex-1 items-center justify-end gap-[2px] overflow-hidden" dir="ltr">
              {voiceTick.levels.map((l, i) => (
                <span key={i} className="w-[3px] shrink-0 rounded-full bg-rose-400" style={{ height: `${Math.max(10, l * 100)}%` }} />
              ))}
            </div>
            <span className="hidden text-xs text-slate-400 sm:inline">{t("recordingVoice")}</span>
            <button
              type="button"
              onClick={finishVoice}
              title={t("sendVoice")}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-white shadow-md transition hover:bg-emerald-700"
            >
              <SendHorizontal className="h-4 w-4 rtl:rotate-180" />
            </button>
          </div>
        )}

        <textarea
          ref={inputRef}
          value={text}
          disabled={disabled}
          maxLength={MAX_MESSAGE_LENGTH + 500}
          onChange={(e) => {
            setText(e.target.value);
            detectMention(e.target.value, e.target.selectionStart);
          }}
          onClick={(e) => detectMention(text, e.currentTarget.selectionStart)}
          onPaste={(e) => {
            if (editing) return;
            const pasted = Array.from(e.clipboardData.files);
            if (pasted.length) {
              e.preventDefault();
              addFiles(pasted);
            }
          }}
          onKeyDown={(e) => {
            if (mention && suggestions.length > 0) {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setMentionIndex((i) => (i + 1) % suggestions.length);
                return;
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setMentionIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
                return;
              }
              if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                pickMention(suggestions[mentionIndex]);
                return;
              }
              if (e.key === "Escape") {
                setMention(null);
                return;
              }
            }
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
            if (e.key === "Escape" && quoting && !editing) onCancelQuote?.();
            if (e.key === "Escape" && editing) {
              onCancelEdit();
              setText("");
            }
          }}
          rows={1}
          dir="auto"
          placeholder={placeholder}
          className={`${voice ? "hidden" : "block"} max-h-[220px] w-full resize-none bg-transparent px-3 py-2.5 text-[15px] text-slate-800 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed`}
        />

        {/* Bottom bar */}
        <div className={`${voice ? "hidden" : "flex"} items-center gap-0.5 px-1.5 pb-1.5`}>
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <ToolButton title={t("attach")} onClick={() => fileRef.current?.click()} disabled={disabled || Boolean(editing)}>
            <Paperclip className="h-4 w-4" />
          </ToolButton>
          <div className="relative">
            <ToolButton title={t("emoji")} onClick={() => setPopover((p) => (p === "emoji" ? null : "emoji"))} active={popover === "emoji"} disabled={disabled}>
              <Smile className="h-4 w-4" />
            </ToolButton>
            {popover === "emoji" && (
              <div className="absolute bottom-10 start-0 z-30 w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-2xl">
                <div className="grid grid-cols-8 gap-0.5">
                  {EMOJIS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onMouseDown={(ev) => ev.preventDefault()}
                      onClick={() => insertAtCaret(e)}
                      className="rounded-md p-1 text-xl transition hover:scale-110 hover:bg-slate-100"
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <ToolButton
            title={t("mention")}
            onClick={() => {
              insertAtCaret("@");
              setMention({ start: (inputRef.current?.selectionStart ?? text.length), query: "" });
            }}
            disabled={disabled}
          >
            <AtSign className="h-4 w-4" />
          </ToolButton>
          {!compact && (
            <div className="relative">
              <ToolButton title={t("stickers")} onClick={() => setPopover((p) => (p === "stickers" ? null : "stickers"))} active={popover === "stickers"} disabled={disabled || Boolean(editing)}>
                <StickerIcon className="h-4 w-4" />
              </ToolButton>
              {popover === "stickers" && (
                <div className="absolute bottom-10 start-0 z-30 w-[340px] rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-800">{t("stickers")}</span>
                    <button type="button" onClick={() => setPopover(null)} className="rounded p-1 text-slate-400 hover:bg-slate-100">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid max-h-80 grid-cols-3 gap-3 overflow-y-auto p-1">
                    {STICKERS.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => sendSticker(s.id)}
                        className={`flex items-center justify-center rounded-2xl p-1.5 transition hover:scale-105 hover:bg-slate-50 ${s.premium ? "col-span-3 bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-50 py-4 ring-1 ring-amber-200" : ""}`}
                        title={s.caption[locale]}
                      >
                        <Sticker id={s.id} locale={locale} size={s.premium ? 120 : 88} />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {!editing && !text.trim() && files.length === 0 ? (
            <button
              type="button"
              onClick={startVoice}
              disabled={disabled || busy}
              className="ms-auto flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-white shadow-sm transition hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
              title={t("recordVoice")}
              data-testid="voice-start"
            >
              <Mic className="h-4 w-4" />
            </button>
          ) : (
          <button
            type="button"
            onClick={submit}
            disabled={disabled || busy || (!text.trim() && files.length === 0)}
            className="ms-auto flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-white shadow-sm transition hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
            title={t("send")}
          >
            <SendHorizontal className="h-4 w-4 rtl:rotate-180" />
          </button>
          )}
        </div>
      </div>
      {!compact && (
        <p className="mt-1.5 flex items-center gap-1 px-1 text-[11px] text-slate-400">
          <ShieldCheck className="h-3 w-3 text-emerald-500" />
          {t("securityNote")}
          <span className="ms-auto hidden sm:inline">{t("formatHint")}</span>
        </p>
      )}
    </div>
  );
}
