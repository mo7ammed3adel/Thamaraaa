"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, Paperclip, Pencil, Reply, SendHorizontal, ShieldCheck, Sticker as StickerIcon, X } from "lucide-react";
import type { ChatMessage } from "@/client/api/chat";
import { MAX_FILES_PER_MESSAGE, MAX_FILE_BYTES, MAX_MESSAGE_LENGTH, STICKERS, formatBytes } from "@/lib/chat/constants";
import { Sticker } from "./ChatBits";
import { useChatT } from "./useChatT";

export type ComposerSubmit =
  | { kind: "text"; body: string; files: File[] }
  | { kind: "sticker"; stickerId: string }
  | { kind: "edit"; id: string; body: string };

export default function Composer({
  disabled,
  replyTo,
  editing,
  uploadProgress,
  onCancelReply,
  onCancelEdit,
  onSubmit,
  onError,
}: {
  disabled?: boolean;
  replyTo: ChatMessage | null;
  editing: ChatMessage | null;
  uploadProgress: number | null;
  onCancelReply: () => void;
  onCancelEdit: () => void;
  onSubmit: (input: ComposerSubmit) => Promise<boolean>;
  onError: (message: string) => void;
}) {
  const { t, locale } = useChatT();
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [stickers, setStickers] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setText(editing.body || "");
      setFiles([]);
      inputRef.current?.focus();
    }
  }, [editing]);

  useEffect(() => {
    if (replyTo) inputRef.current?.focus();
  }, [replyTo]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [text]);

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
    const body = text.trim();
    if (editing) {
      if (!body) return;
      setBusy(true);
      const ok = await onSubmit({ kind: "edit", id: editing.id, body });
      setBusy(false);
      if (ok) setText("");
      return;
    }
    if (!body && files.length === 0) return;
    setBusy(true);
    const ok = await onSubmit({ kind: "text", body, files });
    setBusy(false);
    if (ok) {
      setText("");
      setFiles([]);
    }
    inputRef.current?.focus();
  }

  async function sendSticker(stickerId: string) {
    setStickers(false);
    setBusy(true);
    await onSubmit({ kind: "sticker", stickerId });
    setBusy(false);
  }

  return (
    <div
      className="relative border-t border-slate-200 bg-white px-4 pb-4 pt-3"
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
        <div className="pointer-events-none absolute inset-2 z-10 flex items-center justify-center rounded-2xl border-2 border-dashed border-emerald-400 bg-emerald-50/90 text-sm font-semibold text-emerald-700">
          {t("dropFiles")}
        </div>
      )}

      {(replyTo || editing) && (
        <div className="mb-2 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 ring-1 ring-slate-200">
          {editing ? <Pencil className="h-3.5 w-3.5 text-amber-600" /> : <Reply className="h-3.5 w-3.5 text-emerald-600" />}
          <span className="font-semibold">{editing ? t("editing") : `${t("replyingTo")} ${replyTo?.sender?.name ?? ""}`}</span>
          {!editing && <span className="line-clamp-1 flex-1 text-slate-500">{replyTo?.body || t("attachment")}</span>}
          <button
            type="button"
            className="ms-auto rounded p-1 hover:bg-slate-200"
            onClick={() => {
              if (editing) {
                onCancelEdit();
                setText("");
              } else onCancelReply();
            }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {files.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {files.map((f, i) => (
            <div key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-lg bg-slate-100 py-1.5 pe-1.5 ps-2.5 text-xs text-slate-700">
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

      <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50/60 p-1.5 shadow-sm transition focus-within:border-emerald-300 focus-within:bg-white focus-within:ring-4 focus-within:ring-emerald-100">
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
        <button
          type="button"
          disabled={disabled || Boolean(editing)}
          onClick={() => fileRef.current?.click()}
          className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-200 hover:text-slate-800 disabled:opacity-40"
          title={t("attach")}
        >
          <Paperclip className="h-5 w-5" />
        </button>
        <div className="relative">
          <button
            type="button"
            disabled={disabled || Boolean(editing)}
            onClick={() => setStickers((v) => !v)}
            className={`rounded-xl p-2 transition hover:bg-slate-200 hover:text-slate-800 disabled:opacity-40 ${stickers ? "bg-amber-100 text-amber-700" : "text-slate-500"}`}
            title={t("stickers")}
          >
            <StickerIcon className="h-5 w-5" />
          </button>
          {stickers && (
            <div className="absolute bottom-12 start-0 z-30 w-[340px] rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-800">{t("stickers")}</span>
                <button type="button" onClick={() => setStickers(false)} className="rounded p-1 text-slate-400 hover:bg-slate-100">
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
        <textarea
          ref={inputRef}
          value={text}
          disabled={disabled}
          maxLength={MAX_MESSAGE_LENGTH}
          onChange={(e) => setText(e.target.value)}
          onPaste={(e) => {
            if (editing) return;
            const pasted = Array.from(e.clipboardData.files);
            if (pasted.length) {
              e.preventDefault();
              addFiles(pasted);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
            if (e.key === "Escape") {
              if (editing) {
                onCancelEdit();
                setText("");
              } else if (replyTo) onCancelReply();
            }
          }}
          rows={1}
          dir="auto"
          placeholder={t("typeMessage")}
          className="max-h-[200px] flex-1 resize-none bg-transparent px-2 py-2 text-[15px] text-slate-800 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed"
        />
        <button
          type="button"
          onClick={submit}
          disabled={disabled || busy || (!text.trim() && files.length === 0)}
          className="rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 p-2.5 text-white shadow-md shadow-emerald-500/30 transition hover:brightness-110 disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none"
          title={t("send")}
        >
          <SendHorizontal className="h-5 w-5 rtl:rotate-180" />
        </button>
      </div>
      <p className="mt-1.5 flex items-center gap-1 px-1 text-[11px] text-slate-400">
        <ShieldCheck className="h-3 w-3 text-emerald-500" />
        {t("securityNote")}
      </p>
    </div>
  );
}
