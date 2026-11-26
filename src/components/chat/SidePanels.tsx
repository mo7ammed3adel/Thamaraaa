"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Hash, Lock, MessageSquareText, Pin, Search, Users, X } from "lucide-react";
import {
  ChatUploadError,
  deleteMessage,
  editMessage,
  getThread,
  listPins,
  searchMessages,
  sendFileMessage,
  sendTextMessage,
  toggleReaction,
  togglePin,
  type ChatAttachment,
  type ChatMessage,
  type SearchHit,
} from "@/client/api/chat";
import { Avatar } from "./ChatBits";
import Composer, { type ComposerSubmit, type MentionMember } from "./Composer";
import MessageItem, { formatTime } from "./MessageItem";
import { Mrkdwn } from "./mrkdwn";
import { useChatT } from "./useChatT";

function PanelShell({ title, subtitle, icon, onClose, children }: { title: string; subtitle?: string | null; icon: React.ReactNode; onClose: () => void; children: React.ReactNode }) {
  return (
    <aside className="flex w-full shrink-0 flex-col border-s border-slate-200 bg-white md:w-[400px]">
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-slate-200 px-4">
        <span className="text-slate-500">{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold text-slate-900">{title}</p>
          {subtitle && <p className="truncate text-xs text-slate-500">{subtitle}</p>}
        </div>
        <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
          <X className="h-5 w-5" />
        </button>
      </div>
      {children}
    </aside>
  );
}

type Shared = {
  meId: string;
  names: Map<string, string>;
  members: MentionMember[];
  canModerate: boolean;
  onError: (m: string) => void;
  explainError: (e: unknown) => void;
  onOpenImage: (a: ChatAttachment) => void;
  /** Lets the main list refresh (thread counts, pins). */
  onChanged: () => void;
};

export function ThreadPanel({
  rootId,
  conversationName,
  refreshKey,
  readOnly,
  live,
  onClose,
  ...shared
}: Shared & { rootId: string; conversationName: string | null; refreshKey: number; readOnly: boolean; live: boolean; onClose: () => void }) {
  const { t } = useChatT();
  const [root, setRoot] = useState<ChatMessage | null>(null);
  const [replies, setReplies] = useState<ChatMessage[]>([]);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const rootRef = useRef(rootId);
  rootRef.current = rootId;

  const load = useCallback(async () => {
    try {
      const data = await getThread(rootId);
      if (rootRef.current !== rootId) return;
      setRoot(data.root);
      setReplies(data.replies);
    } catch (e) {
      // Only a thread that no longer exists (or you can't see) closes the
      // panel; a passing network error must not throw away a draft reply.
      if (e && typeof e === "object" && (e as { status?: number }).status === 404) onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootId]);

  useEffect(() => {
    setRoot(null);
    setReplies([]);
    atBottom.current = true;
    load();
  }, [load]);

  useEffect(() => {
    const h = setInterval(() => !document.hidden && load(), live ? 30000 : 5000);
    return () => clearInterval(h);
  }, [load, live]);

  // Realtime pings / main-list polls bump this.
  // At most one extra reload every 3s, however busy the channel is.
  const lastBump = useRef(0);
  useEffect(() => {
    if (!refreshKey || Date.now() - lastBump.current < 3000) return;
    lastBump.current = Date.now();
    load();
  }, [refreshKey, load]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
  }, [replies]);

  async function submit(input: ComposerSubmit): Promise<boolean> {
    if (!root) return false;
    atBottom.current = true;
    try {
      if (input.kind === "edit") {
        await editMessage(input.id, input.body);
        setEditing(null);
      } else if (input.kind === "text" && input.files.length > 0) {
        setProgress(0);
        await sendFileMessage(root.conversationId, { body: input.body, replyToId: root.id, files: input.files }, setProgress);
      } else if (input.kind === "text") {
        await sendTextMessage(root.conversationId, { body: input.body, replyToId: root.id });
      } else {
        await sendTextMessage(root.conversationId, { stickerId: input.stickerId, replyToId: root.id });
      }
      await load();
      shared.onChanged();
      return true;
    } catch (e) {
      shared.explainError(e);
      return false;
    } finally {
      setProgress(null);
    }
  }

  async function act(fn: () => Promise<unknown>) {
    try {
      await fn();
      await load();
      shared.onChanged();
    } catch (e) {
      shared.explainError(e);
    }
  }

  const item = (m: ChatMessage, grouped: boolean) => (
    <MessageItem
      key={m.id}
      message={m}
      meId={shared.meId}
      names={shared.names}
      grouped={grouped}
      canModerate={shared.canModerate}
      inThread
      onOpenThread={() => undefined}
      onEdit={setEditing}
      onDelete={(x) => window.confirm(t("confirmDelete")) && act(() => deleteMessage(x.id))}
      onReact={(x, e) => act(() => toggleReaction(x.id, e))}
      onPin={(x) => act(() => togglePin(x.id))}
      onOpenImage={shared.onOpenImage}
    />
  );

  return (
    <PanelShell title={t("thread")} subtitle={conversationName ? `${conversationName}` : null} icon={<MessageSquareText className="h-5 w-5" />} onClose={onClose}>
      <div
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
        }}
        className="flex-1 overflow-y-auto py-2"
      >
        {root && item(root, false)}
        {root && (
          <div className="my-2 flex items-center gap-3 px-4">
            <span className="text-xs font-semibold text-slate-500">
              {replies.filter((r) => !r.deleted).length} {replies.filter((r) => !r.deleted).length === 1 ? t("reply1") : t("replies")}
            </span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>
        )}
        {replies.map((m, i) => {
          const prev = replies[i - 1];
          const grouped = Boolean(prev && prev.sender?.id === m.sender?.id && new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60 * 1000);
          return item(m, grouped);
        })}
      </div>
      {!readOnly && (
        <div className="border-t border-slate-100">
          <Composer
            key={rootId}
            compact
            editing={editing}
            uploadProgress={progress}
            members={shared.members}
            names={shared.names}
            placeholder={t("replyPlaceholder")}
            onCancelEdit={() => setEditing(null)}
            onSubmit={submit}
            onError={shared.onError}
          />
        </div>
      )}
    </PanelShell>
  );
}

export function PinsPanel({
  conversationId,
  refreshKey,
  onClose,
  onJump,
  ...shared
}: Shared & { conversationId: string; refreshKey: number; onClose: () => void; onJump: (m: ChatMessage) => void }) {
  const { t, locale } = useChatT();
  const [pins, setPins] = useState<ChatMessage[] | null>(null);

  const load = useCallback(() => {
    listPins(conversationId).then(setPins).catch(() => setPins([]));
  }, [conversationId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  return (
    <PanelShell title={t("pinnedMessages")} icon={<Pin className="h-5 w-5" />} onClose={onClose}>
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {pins?.length === 0 && (
          <div className="px-4 py-10 text-center">
            <Pin className="mx-auto mb-3 h-8 w-8 text-slate-300" />
            <p className="text-sm font-semibold text-slate-700">{t("noPins")}</p>
            <p className="mt-1 text-xs text-slate-500">{t("noPinsHint")}</p>
          </div>
        )}
        {pins?.map((m) => (
          <div key={m.id} className="group rounded-xl border border-slate-200 bg-white p-3 hover:border-slate-300 hover:shadow-sm">
            <div className="mb-1 flex items-center gap-2">
              <Avatar name={m.sender?.name} seed={m.sender?.id} size={22} />
              <span className="text-sm font-bold text-slate-800">{m.sender?.name}</span>
              <span className="text-[11px] text-slate-400">{formatTime(m.createdAt, locale)}</span>
              <button
                onClick={async () => {
                  try {
                    await togglePin(m.id);
                    load();
                    shared.onChanged();
                  } catch (e) {
                    shared.explainError(e);
                  }
                }}
                className="ms-auto hidden rounded px-2 py-0.5 text-[11px] font-semibold text-slate-500 hover:bg-slate-100 group-hover:block"
              >
                {t("unpin")}
              </button>
            </div>
            <button onClick={() => onJump(m)} className="block w-full text-start">
              <div className="line-clamp-4 whitespace-pre-wrap break-words text-sm text-slate-700" dir="auto">
                {m.body ? <Mrkdwn text={m.body} names={shared.names} meId={shared.meId} /> : m.attachments.length ? `📎 ${m.attachments.map((a) => a.originalName).join("، ")}` : t("sticker")}
              </div>
            </button>
          </div>
        ))}
      </div>
    </PanelShell>
  );
}

function highlight(text: string, q: string) {
  if (!q) return text;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded bg-amber-200 px-0.5 text-slate-900">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

export function SearchPanel({ initialQuery, onClose, onOpen }: { initialQuery: string; onClose: () => void; onOpen: (hit: SearchHit) => void }) {
  const { t, locale } = useChatT();
  const [q, setQ] = useState(initialQuery);
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const searchSeq = useRef(0);
  const [rateLimited, setRateLimited] = useState(false);

  useEffect(() => setQ(initialQuery), [initialQuery]);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setHits(null);
      return;
    }
    setLoading(true);
    setRateLimited(false);
    const seq = ++searchSeq.current;
    const h = setTimeout(() => {
      searchMessages(query)
        .then((res) => seq === searchSeq.current && setHits(res))
        .catch((e) => {
          if (seq !== searchSeq.current) return;
          if ((e as { status?: number })?.status === 429) setRateLimited(true);
          setHits([]);
        })
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(h);
  }, [q]);

  return (
    <PanelShell title={t("searchResults")} icon={<Search className="h-5 w-5" />} onClose={onClose}>
      <div className="border-b border-slate-100 p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            // Opened from the top bar the user keeps typing there; don't steal focus.
            autoFocus={!initialQuery}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("searchMessages")}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pe-3 ps-9 text-sm outline-none focus:border-emerald-300 focus:bg-white focus:ring-4 focus:ring-emerald-100"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {q.trim().length < 2 && <p className="px-4 py-10 text-center text-sm text-slate-400">{t("searchHint")}</p>}
        {loading && hits === null && <p className="px-4 py-6 text-center text-sm text-slate-400">…</p>}
        {rateLimited && <p className="px-4 pt-6 text-center text-sm text-amber-700">{t("rateLimited")}</p>}
        {hits?.length === 0 && !loading && !rateLimited && <p className="px-4 py-10 text-center text-sm text-slate-500">{t("noSearchResults")}</p>}
        {hits?.map((h) => (
          <button key={h.id} onClick={() => onOpen(h)} className="block w-full border-b border-slate-100 px-4 py-3 text-start hover:bg-slate-50">
            <div className="mb-1 flex items-center gap-1.5 text-xs text-slate-500">
              {h.conversationType === "channel" ? <Hash className="h-3 w-3" /> : h.conversationType === "group" ? <Users className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
              <span className="font-semibold text-slate-700">{h.conversationName}</span>
              {h.threadRootId && <span className="rounded bg-slate-100 px-1.5 text-[10px]">{t("thread")}</span>}
              <span className="ms-auto">{new Date(h.createdAt).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US", { day: "numeric", month: "short" })}</span>
            </div>
            <div className="flex items-start gap-2">
              <Avatar name={h.sender?.name} seed={h.sender?.id} size={24} />
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-800">{h.sender?.name}</p>
                <p className="line-clamp-3 whitespace-pre-wrap break-words text-sm text-slate-700" dir="auto">{highlight(h.body, q.trim())}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </PanelShell>
  );
}

export { ChatUploadError };
