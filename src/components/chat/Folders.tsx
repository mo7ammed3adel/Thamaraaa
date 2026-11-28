"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, Folder, FolderInput, FolderMinus, FolderOpen, FolderPlus, GripVertical, Pencil, Trash2, X } from "lucide-react";
import type { ChatFolder, ChatType, ConversationSummary } from "@/client/api/chat";
import { LABEL_COLORS, MAX_LABEL_NAME, labelStyle } from "@/lib/chat/labels";
import { groupIntoFolders, type DropTarget } from "@/lib/chat/folders";
import { useChatT } from "./useChatT";

/** What's being dragged right now (dataTransfer can't be read during dragover). */
export type DragState = { kind: "conv"; id: string; section: ChatType; fromFolder: string | null } | { kind: "folder"; id: string; section: ChatType } | null;

const COLLAPSE_KEY = "chat:folders:collapsed";

function readCollapsed(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(COLLAPSE_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

/** Folder text colour per palette key (the dot classes are too dark for text). */
const FOLDER_TEXT: Record<string, string> = {
  emerald: "text-emerald-400",
  sky: "text-sky-400",
  amber: "text-amber-400",
  rose: "text-rose-400",
  violet: "text-violet-400",
  teal: "text-teal-400",
  orange: "text-orange-400",
  pink: "text-pink-400",
  lime: "text-lime-400",
  slate: "text-slate-400",
};

const LONG_PRESS_MS = 500;
/** A finger that drifts further than this is scrolling, not pressing. */
const LONG_PRESS_SLOP = 10;

/**
 * Touch long-press: calls `onPress` after the finger rests on the element,
 * and swallows the click that follows so the conversation doesn't also open.
 */
function useLongPress(onPress: (id: string) => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    start.current = null;
  };
  useEffect(() => cancel, []);
  return (id: string) => ({
    onTouchStart: (e: React.TouchEvent) => {
      fired.current = false;
      const t = e.touches[0];
      start.current = { x: t.clientX, y: t.clientY };
      timer.current = setTimeout(() => {
        fired.current = true;
        timer.current = null;
        navigator.vibrate?.(15);
        onPress(id);
      }, LONG_PRESS_MS);
    },
    onTouchMove: (e: React.TouchEvent) => {
      const t = e.touches[0];
      if (start.current && Math.hypot(t.clientX - start.current.x, t.clientY - start.current.y) > LONG_PRESS_SLOP) cancel();
    },
    onTouchEnd: cancel,
    onTouchCancel: cancel,
    // Mobile browsers open their own menu on a long press; ours replaces it.
    onContextMenu: (e: React.MouseEvent) => {
      if (fired.current || timer.current) e.preventDefault();
    },
    onClickCapture: (e: React.MouseEvent) => {
      if (fired.current) {
        e.preventDefault();
        e.stopPropagation();
        fired.current = false;
      }
    },
  });
}

/** Bottom sheet: move one conversation into a folder of its section, or out. */
function MoveToFolderSheet({
  conversation,
  folders,
  currentFolder,
  onPick,
  onCreate,
  onClose,
}: {
  conversation: ConversationSummary;
  folders: ChatFolder[];
  currentFolder: string | null;
  onPick: (folderId: string | null) => void;
  onCreate: (name: string, color: string) => void;
  onClose: () => void;
}) {
  const { t } = useChatT();
  const [creating, setCreating] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 backdrop-blur-sm sm:items-center" onClick={onClose} data-testid="move-sheet">
      <div className="w-full max-w-sm rounded-t-2xl bg-slate-900 pb-[env(safe-area-inset-bottom)] text-slate-200 shadow-2xl ring-1 ring-white/10 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-white/20 sm:hidden" />
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
          <FolderInput className="h-4 w-4 shrink-0 text-emerald-400" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold">{t("moveToFolder")}</p>
            <p className="truncate text-[12px] text-slate-400">{conversation.name}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {folders.length === 0 && !creating && <p className="px-3 py-3 text-center text-[13px] text-slate-500">{t("noFoldersHere")}</p>}
          {folders.map((f) => (
            <button key={f.id} onClick={() => onPick(f.id)} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-start text-[15px] active:bg-white/10" data-testid="move-option">
              <Folder className={`h-5 w-5 shrink-0 ${FOLDER_TEXT[f.color] ?? FOLDER_TEXT.slate}`} />
              <span className="flex-1 truncate">{f.name}</span>
              {currentFolder === f.id && <Check className="h-4 w-4 text-emerald-400" />}
            </button>
          ))}
          {currentFolder && (
            <button onClick={() => onPick(null)} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-start text-[15px] text-slate-300 active:bg-white/10" data-testid="move-out">
              <FolderMinus className="h-5 w-5 shrink-0 text-slate-400" />
              {t("removeFromFolder")}
            </button>
          )}
          {creating ? (
            <FolderForm onCancel={() => setCreating(false)} onSave={onCreate} />
          ) : (
            <button onClick={() => setCreating(true)} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-start text-[15px] font-semibold text-emerald-400 active:bg-white/10">
              <FolderPlus className="h-5 w-5 shrink-0" />
              {t("newFolder")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Inline name + colour editor, used for both new and existing folders. */
export function FolderForm({ initial, onSave, onCancel }: { initial?: { name: string; color: string }; onSave: (name: string, color: string) => void; onCancel: () => void }) {
  const { t } = useChatT();
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState(initial?.color ?? LABEL_COLORS[1]);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  return (
    <form
      className="mx-1 my-1 space-y-1.5 rounded-lg bg-white/5 p-2 ring-1 ring-white/10"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) onSave(name.trim(), color);
      }}
      onKeyDown={(e) => e.key === "Escape" && onCancel()}
      data-testid="folder-form"
    >
      <input
        ref={input}
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={MAX_LABEL_NAME}
        placeholder={t("folderName")}
        className="w-full rounded-md border border-white/10 bg-slate-950/40 px-2 py-1 text-[13px] text-white outline-none placeholder:text-slate-500 focus:border-emerald-500/50"
        data-testid="folder-name"
      />
      <div className="flex items-center justify-between gap-1">
        <div className="flex flex-wrap gap-1">
          {LABEL_COLORS.map((c) => (
            <button key={c} type="button" onClick={() => setColor(c)} className={`h-3.5 w-3.5 rounded-full ${labelStyle(c).dot} ${color === c ? "ring-2 ring-white ring-offset-1 ring-offset-slate-900" : ""}`} aria-label={c} />
          ))}
        </div>
        <div className="flex gap-0.5">
          <button type="button" onClick={onCancel} className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-white">
            <X className="h-3.5 w-3.5" />
          </button>
          <button type="submit" disabled={!name.trim()} className="rounded bg-emerald-600 p-1 text-white hover:bg-emerald-500 disabled:opacity-40" data-testid="folder-save">
            <Check className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </form>
  );
}

/**
 * One sidebar section's conversations: your folders first (each collapsible,
 * draggable to reorder), then the loose conversations. Drag a conversation
 * onto a folder to file it, onto a row to place it there, or onto the loose
 * area to take it out again.
 */
export function SectionBody({
  section,
  items,
  folders,
  drag,
  setDrag,
  renderRow,
  onMove,
  onReorderFolders,
  onRenameFolder,
  onDeleteFolder,
  onCreateAndMove,
}: {
  section: ChatType;
  items: ConversationSummary[];
  folders: ChatFolder[];
  drag: DragState;
  setDrag: (d: DragState) => void;
  renderRow: (c: ConversationSummary) => ReactNode;
  onMove: (conversationId: string, target: DropTarget) => void;
  onReorderFolders: (section: ChatType, ids: string[], movedId: string, beforeId: string) => void;
  onRenameFolder: (id: string, name: string, color: string) => void;
  onDeleteFolder: (id: string) => void;
  /** Mobile sheet: make a folder and put the conversation straight into it. */
  onCreateAndMove: (section: ChatType, name: string, color: string, conversationId: string) => void;
}) {
  const { t } = useChatT();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<string | null>(null);
  /** Highlighted drop spot: a folder header, a row ("before"), or the loose area. */
  const [over, setOver] = useState<string | null>(null);
  /** The conversation whose "move to folder" sheet is open (long press on touch). */
  const [sheetFor, setSheetFor] = useState<string | null>(null);
  const longPress = useLongPress(setSheetFor);
  useEffect(() => setCollapsed(readCollapsed()), []);
  useEffect(() => {
    if (!drag) setOver(null);
  }, [drag]);

  function toggle(id: string) {
    setCollapsed((c) => {
      const next = { ...c, [id]: !c[id] };
      try {
        localStorage.setItem(COLLAPSE_KEY, JSON.stringify(next));
      } catch {
        /* per-viewer convenience only */
      }
      return next;
    });
  }

  const { grouped, loose } = groupIntoFolders(items, folders);
  const convDrag = drag?.kind === "conv" && drag.section === section ? drag : null;
  const folderDrag = drag?.kind === "folder" && drag.section === section ? drag : null;

  /** Props that make an element a drop zone for conversations of this section. */
  function zone(key: string, target: DropTarget) {
    return {
      onDragOver: (e: React.DragEvent) => {
        if (!convDrag) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "move";
        if (over !== key) setOver(key);
      },
      onDragLeave: (e: React.DragEvent) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver((o) => (o === key ? null : o));
      },
      onDrop: (e: React.DragEvent) => {
        if (!convDrag) return;
        e.preventDefault();
        e.stopPropagation();
        onMove(convDrag.id, target);
        setDrag(null);
      },
    };
  }

  function draggableRow(c: ConversationSummary, folderId: string | null) {
    const key = `row:${c.id}`;
    return (
      <div
        key={c.id}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", c.id);
          setDrag({ kind: "conv", id: c.id, section, fromFolder: folderId });
        }}
        onDragEnd={() => setDrag(null)}
        {...longPress(c.id)}
        {...(folderId !== null || convDrag?.fromFolder ? zone(key, { folderId, beforeId: c.id }) : {})}
        className={`relative ${convDrag?.id === c.id ? "opacity-40" : ""}`}
        data-testid="conv-row"
      >
        {over === key && convDrag?.id !== c.id && folderId !== null && <span className="pointer-events-none absolute inset-x-1 -top-px h-0.5 rounded bg-emerald-400" />}
        {renderRow(c)}
      </div>
    );
  }

  const order = folders.map((f) => f.id);
  const sheetConversation = sheetFor ? items.find((c) => c.id === sheetFor) ?? null : null;

  return (
    <>
      {grouped.map(({ folder, items: inside }) => {
        const open = !collapsed[folder.id];
        const unread = inside.reduce((n, c) => n + (c.unread > 0 ? 1 : 0), 0);
        const headKey = `folder:${folder.id}`;
        const isOver = over === headKey && (convDrag || (folderDrag && folderDrag.id !== folder.id));
        if (editing === folder.id)
          return (
            <FolderForm
              key={folder.id}
              initial={folder}
              onCancel={() => setEditing(null)}
              onSave={(name, color) => {
                onRenameFolder(folder.id, name, color);
                setEditing(null);
              }}
            />
          );
        return (
          <div key={folder.id} className={`mb-0.5 ${folderDrag?.id === folder.id ? "opacity-40" : ""}`} data-testid="chat-folder">
            <div
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", folder.id);
                setDrag({ kind: "folder", id: folder.id, section });
              }}
              onDragEnd={() => setDrag(null)}
              onDragOver={(e) => {
                if (!convDrag && !(folderDrag && folderDrag.id !== folder.id)) return;
                e.preventDefault();
                e.stopPropagation();
                if (over !== headKey) setOver(headKey);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver((o) => (o === headKey ? null : o));
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (convDrag) onMove(convDrag.id, { folderId: folder.id });
                else if (folderDrag && folderDrag.id !== folder.id) onReorderFolders(section, order, folderDrag.id, folder.id);
                setDrag(null);
              }}
              className={`group/folder relative flex items-center gap-1 rounded-md px-1 py-1 transition ${isOver ? (convDrag ? "bg-emerald-500/15 ring-1 ring-emerald-400/60" : "") : "hover:bg-white/5"}`}
            >
              {isOver && folderDrag && <span className="pointer-events-none absolute inset-x-1 -top-px h-0.5 rounded bg-emerald-400" />}
              <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-slate-600 opacity-0 group-hover/folder:opacity-100" />
              <button onClick={() => toggle(folder.id)} className="flex min-w-0 flex-1 items-center gap-1.5 text-start">
                <ChevronDown className={`h-3 w-3 shrink-0 text-slate-500 transition ${open ? "" : "-rotate-90 rtl:rotate-90"}`} />
                {open || isOver ? <FolderOpen className={`h-4 w-4 shrink-0 ${FOLDER_TEXT[folder.color] ?? FOLDER_TEXT.slate}`} /> : <Folder className={`h-4 w-4 shrink-0 ${FOLDER_TEXT[folder.color] ?? FOLDER_TEXT.slate}`} />}
                <span className="truncate text-[13px] font-semibold text-slate-200">{folder.name}</span>
                <span className="shrink-0 text-[11px] text-slate-500">{inside.length}</span>
              </button>
              {!open && unread > 0 && <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">{unread}</span>}
              <span className="flex shrink-0 opacity-0 group-hover/folder:opacity-100 [@media(hover:none)]:opacity-100">
                <button onClick={() => setEditing(folder.id)} className="rounded p-0.5 text-slate-500 hover:bg-white/10 hover:text-white" title={t("editFolder")}>
                  <Pencil className="h-3 w-3" />
                </button>
                <button onClick={() => window.confirm(t("confirmDeleteFolder")) && onDeleteFolder(folder.id)} className="rounded p-0.5 text-slate-500 hover:bg-rose-500/20 hover:text-rose-300" title={t("deleteFolder")}>
                  <Trash2 className="h-3 w-3" />
                </button>
              </span>
            </div>
            {open && (
              <div className="ms-3 border-s border-white/10 ps-1">
                {inside.map((c) => draggableRow(c, folder.id))}
                {inside.length === 0 && (
                  <div {...zone(headKey, { folderId: folder.id })} className="px-2.5 py-1 text-[12px] italic text-slate-600">
                    {t("dropHere")}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      <div
        {...zone(`loose:${section}`, { folderId: null })}
        className={`rounded-md transition ${over === `loose:${section}` && convDrag?.fromFolder ? "bg-white/5 outline-dashed outline-1 outline-white/20" : ""}`}
      >
        {loose.map((c) => draggableRow(c, null))}
        {convDrag?.fromFolder && <div className="px-2.5 py-1.5 text-center text-[12px] text-slate-500">{t("dropOutOfFolder")}</div>}
      </div>

      {sheetConversation && (
        <MoveToFolderSheet
          conversation={sheetConversation}
          folders={folders}
          currentFolder={folders.find((f) => f.conversationIds.includes(sheetConversation.id))?.id ?? null}
          onClose={() => setSheetFor(null)}
          onPick={(folderId) => {
            onMove(sheetConversation.id, { folderId });
            setSheetFor(null);
          }}
          onCreate={(name, color) => {
            onCreateAndMove(section, name, color, sheetConversation.id);
            setSheetFor(null);
          }}
        />
      )}
    </>
  );
}
