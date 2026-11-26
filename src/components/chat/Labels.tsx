"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Pencil, Plus, Tag, Trash2, X } from "lucide-react";
import { createChatLabel, deleteChatLabel, updateChatLabel, type ChatLabel } from "@/client/api/chat";
import { LABEL_COLORS, MAX_LABEL_NAME, labelStyle } from "@/lib/chat/labels";
import { useChatT } from "./useChatT";

/** Filter chips over the conversation list: All + each of your labels. */
export function LabelFilterBar({
  labels,
  active,
  onPick,
  onManage,
}: {
  labels: ChatLabel[];
  active: string | null;
  onPick: (id: string | null) => void;
  onManage: () => void;
}) {
  const { t } = useChatT();
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto border-b border-white/5 px-3 py-2 [scrollbar-width:none]" data-testid="label-bar">
      <button
        onClick={() => onPick(null)}
        className={`shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-semibold ring-1 transition ${active === null ? "bg-white text-slate-900 ring-white" : "text-slate-300 ring-white/15 hover:bg-white/5"}`}
      >
        {t("allChats")}
      </button>
      {labels.map((l) => {
        const s = labelStyle(l.color);
        const on = active === l.id;
        return (
          <button
            key={l.id}
            onClick={() => onPick(on ? null : l.id)}
            className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-semibold ring-1 transition ${on ? s.active : s.chip}`}
            data-testid="label-chip"
          >
            {!on && <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />}
            {l.name}
            <span className="opacity-60">{l.conversationIds.length}</span>
          </button>
        );
      })}
      <button onClick={onManage} className="flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[12px] text-slate-400 ring-1 ring-dashed ring-white/15 hover:text-white" title={t("manageLabels")} data-testid="manage-labels">
        <Tag className="h-3 w-3" />
        <Plus className="h-3 w-3" />
      </button>
    </div>
  );
}

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {LABEL_COLORS.map((c) => (
        <button key={c} type="button" onClick={() => onChange(c)} className={`h-5 w-5 rounded-full ${labelStyle(c).dot} ${value === c ? "ring-2 ring-slate-900 ring-offset-2" : ""}`} aria-label={c} />
      ))}
    </div>
  );
}

/** Create, rename, recolour and delete your labels. */
export function LabelManager({ labels, onClose, onChanged, onError }: { labels: ChatLabel[]; onClose: () => void; onChanged: () => void; onError: (m: string) => void }) {
  const { t } = useChatT();
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(LABEL_COLORS[0]);
  const [editing, setEditing] = useState<{ id: string; name: string; color: string } | null>(null);

  async function run(task: () => Promise<unknown>) {
    try {
      await task();
      onChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : t("failed"));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()} data-testid="label-manager">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <span className="flex items-center gap-2 font-bold text-slate-800">
            <Tag className="h-4 w-4 text-emerald-600" /> {t("manageLabels")}
          </span>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3 p-4">
          <p className="text-xs text-slate-500">{t("labelsHint")}</p>
          <form
            className="space-y-2 rounded-xl bg-slate-50 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              run(async () => {
                await createChatLabel(name.trim(), color);
                setName("");
              });
            }}
          >
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={MAX_LABEL_NAME} placeholder={t("newLabel")} className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-emerald-300" data-testid="label-name" />
            <div className="flex items-center justify-between gap-2">
              <ColorPicker value={color} onChange={setColor} />
              <button type="submit" disabled={!name.trim()} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-40" data-testid="label-create">
                {t("add")}
              </button>
            </div>
          </form>
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {labels.map((l) =>
              editing?.id === l.id ? (
                <div key={l.id} className="space-y-2 rounded-lg border border-slate-200 p-2">
                  <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} maxLength={MAX_LABEL_NAME} className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm" />
                  <div className="flex items-center justify-between">
                    <ColorPicker value={editing.color} onChange={(c) => setEditing({ ...editing, color: c })} />
                    <button
                      onClick={() =>
                        run(async () => {
                          await updateChatLabel(l.id, { name: editing.name, color: editing.color });
                          setEditing(null);
                        })
                      }
                      className="rounded-md bg-emerald-600 p-1.5 text-white"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div key={l.id} className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                  <span className={`h-2.5 w-2.5 rounded-full ${labelStyle(l.color).dot}`} />
                  <span className="flex-1 truncate text-sm text-slate-800">{l.name}</span>
                  <span className="text-xs text-slate-400">{l.conversationIds.length}</span>
                  <button onClick={() => setEditing({ id: l.id, name: l.name, color: l.color })} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => window.confirm(t("confirmDeleteLabel")) && run(() => deleteChatLabel(l.id))} className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Tick which of your labels are on this conversation. */
export function LabelPicker({
  labels,
  selected,
  onToggle,
  onManage,
  onClose,
}: {
  labels: ChatLabel[];
  selected: string[];
  onToggle: (labelId: string) => void;
  onManage: () => void;
  onClose: () => void;
}) {
  const { t } = useChatT();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const away = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && onClose();
    const id = setTimeout(() => document.addEventListener("mousedown", away), 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener("mousedown", away);
    };
  }, [onClose]);
  return (
    <div ref={ref} className="absolute end-0 top-10 z-30 w-60 rounded-xl border border-slate-200 bg-white p-2 shadow-2xl" data-testid="label-picker">
      <p className="px-2 pb-1 pt-0.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">{t("labels")}</p>
      {labels.length === 0 && <p className="px-2 py-2 text-xs text-slate-500">{t("noLabels")}</p>}
      {labels.map((l) => (
        <button key={l.id} onClick={() => onToggle(l.id)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start text-sm hover:bg-slate-50" data-testid="label-option">
          <span className={`flex h-4 w-4 items-center justify-center rounded border ${selected.includes(l.id) ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300"}`}>
            {selected.includes(l.id) && <Check className="h-3 w-3" />}
          </span>
          <span className={`h-2 w-2 rounded-full ${labelStyle(l.color).dot}`} />
          <span className="truncate text-slate-800">{l.name}</span>
        </button>
      ))}
      <button onClick={onManage} className="mt-1 flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50">
        <Plus className="h-3.5 w-3.5" /> {t("manageLabels")}
      </button>
    </div>
  );
}
