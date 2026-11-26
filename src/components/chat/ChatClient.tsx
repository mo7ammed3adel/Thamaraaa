"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, ChevronDown, Compass, Hash, Info, MessageSquarePlus, MessagesSquare, Pin, Plus, Search, Sparkles, Users } from "lucide-react";
import {
  ChatUploadError,
  deleteMessage,
  editMessage,
  getConversation,
  listConversations,
  listMessages,
  markRead,
  sendFileMessage,
  sendTextMessage,
  toggleReaction,
  togglePin,
  type ChatAttachment,
  type ChatMessage,
  type ChatType,
  type ConversationDetail,
  type ConversationSummary,
  type SearchHit,
} from "@/client/api/chat";
import { findSticker } from "@/lib/chat/constants";
import { notify } from "@/components/toast";
import { Avatar, ConversationIcon } from "./ChatBits";
import Composer, { type ComposerSubmit } from "./Composer";
import MessageItem, { ImageLightbox, formatTime } from "./MessageItem";
import { BrowseChannelsModal, InfoPanel, NewConversationModal } from "./ChatModals";
import { PinsPanel, SearchPanel, ThreadPanel } from "./SidePanels";
import { useChatT } from "./useChatT";

type Me = { id: string; name: string; canCreateChannel: boolean };
type Panel = { kind: "info" } | { kind: "pins" } | { kind: "thread"; rootId: string } | { kind: "search"; q: string } | null;

function dayLabel(iso: string, locale: string, t: ReturnType<typeof useChatT>["t"]) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return t("today");
  if (d.toDateString() === yesterday.toDateString()) return t("yesterday");
  return d.toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US", { weekday: "long", day: "numeric", month: "long" });
}

function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const map = new Map(current.map((m) => [m.id, m]));
  for (const m of incoming) map.set(m.id, m);
  return Array.from(map.values()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Subscribes to the user's private chat channel when Pusher is configured. */
function useChatRealtime(meId: string, onEvent: (conversationId: string) => void) {
  const handler = useRef(onEvent);
  handler.current = onEvent;
  const [live, setLive] = useState(false);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    if (!key) return;
    let client: { unsubscribe: (c: string) => void; disconnect: () => void } | null = null;
    let cancelled = false;
    (async () => {
      const Pusher = (await import("pusher-js")).default;
      if (cancelled) return;
      const pusher = new Pusher(key, {
        cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "eu",
        channelAuthorization: { endpoint: "/api/chat/pusher-auth", transport: "ajax" },
      });
      const channel = pusher.subscribe(`private-chat-${meId}`);
      channel.bind("pusher:subscription_succeeded", () => setLive(true));
      channel.bind("chat", (data: { conversationId?: string }) => data?.conversationId && handler.current(data.conversationId));
      client = pusher;
    })();
    return () => {
      cancelled = true;
      if (client) {
        client.unsubscribe(`private-chat-${meId}`);
        client.disconnect();
      }
    };
  }, [meId]);

  return live;
}

function lastMessagePreview(c: ConversationSummary, t: ReturnType<typeof useChatT>["t"]) {
  const m = c.lastMessage;
  if (!m) return "";
  const who = m.mine ? `${t("you")}: ` : c.type !== "dm" && m.senderName ? `${m.senderName.split(" ")[0]}: ` : "";
  if (m.deleted) return who + t("deleted");
  if (m.kind === "system") return "";
  if (m.kind === "sticker") return `${who}${findSticker(m.stickerId)?.emoji ?? ""} ${t("sticker")}`;
  if (m.body) return who + m.body;
  if (m.hasAttachments) return `${who}📎 ${t("attachment")}`;
  return "";
}

export default function ChatClient({ me }: { me: Me }) {
  const { t, locale } = useChatT();
  const [conversations, setConversations] = useState<ConversationSummary[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [othersReadAt, setOthersReadAt] = useState<string[]>([]);
  const [readMarker, setReadMarker] = useState<string | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [modal, setModal] = useState<ChatType | "browse" | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [panelRefresh, setPanelRefresh] = useState(0);
  const [filter, setFilter] = useState("");
  const [topSearch, setTopSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [lightbox, setLightbox] = useState<ChatAttachment | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const activeRef = useRef<string | null>(null);
  activeRef.current = activeId;
  const pendingThread = useRef<string | null>(null);
  const conversationsRef = useRef<ConversationSummary[] | null>(null);
  conversationsRef.current = conversations;

  const showError = useCallback((message: string) => notify(message, "error"), []);

  const refreshList = useCallback(async () => {
    try {
      setConversations(await listConversations());
    } catch {
      /* keep the last list */
    }
  }, []);

  const refreshActive = useCallback(async (id: string) => {
    try {
      const page = await listMessages(id);
      if (activeRef.current !== id) return;
      setMessages((cur) => {
        // More than a page arrived since the last poll: rather than leave a
        // silent hole, restart from the newest page and offer "load older".
        const newestKnown = cur[cur.length - 1]?.createdAt;
        const oldestFetched = page.messages[0]?.createdAt;
        if (page.hasMore && newestKnown && oldestFetched && oldestFetched > newestKnown) {
          setHasMore(true);
          return page.messages;
        }
        return mergeMessages(cur, page.messages);
      });
      setOthersReadAt(page.othersReadAt);
      if (typeof document !== "undefined" && !document.hidden) markRead(id).catch(() => undefined);
    } catch {
      /* transient */
    }
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    try {
      const d = await getConversation(id);
      if (activeRef.current === id) setDetail(d);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    refreshList();
  }, [refreshList]);

  // Follow ?c= (and ?t= for a thread) — on first load, and whenever a link
  // changes them while the chat is already open (e.g. clicking a mention
  // notification in the bell). Our own replaceState calls land here too and
  // are no-ops because they match the current state.
  const searchParams = useSearchParams();
  useEffect(() => {
    const c = searchParams.get("c");
    const thread = searchParams.get("t");
    if (!c) return;
    if (c !== activeRef.current) {
      pendingThread.current = thread;
      if (thread) setPanel({ kind: "thread", rootId: thread });
      setActiveId(c);
    } else if (thread) {
      setPanel((p) => (p?.kind === "thread" && p.rootId === thread ? p : { kind: "thread", rootId: thread }));
    }
  }, [searchParams]);

  // Switching conversation.
  useEffect(() => {
    setMessages([]);
    setDetail(null);
    setEditing(null);
    setHasMore(false);
    setLoaded(false);
    setReadMarker(null);
    // Keep the search panel; keep a thread only when it was opened *for* this
    // switch (deep link or search hit), never one left over from another chat.
    // (The marker is only consumed once a conversation is actually opening —
    // this effect also runs on mount, before the deep link's conversation is set.)
    const pending = pendingThread.current;
    if (activeId) pendingThread.current = null;
    setPanel((p) => (p?.kind === "search" || (p?.kind === "thread" && p.rootId === pending) ? p : null));
    if (!activeId) return;
    stickToBottom.current = true;
    const url = new URL(window.location.href);
    url.searchParams.set("c", activeId);
    // Drop a thread id left over from the previous conversation.
    if (pending) url.searchParams.set("t", pending);
    else url.searchParams.delete("t");
    window.history.replaceState(null, "", url.toString());
    (async () => {
      try {
        const page = await listMessages(activeId);
        if (activeRef.current !== activeId) return;
        setMessages(page.messages);
        setHasMore(page.hasMore);
        setOthersReadAt(page.othersReadAt);
        // Show "new" only when something arrived since the last visit; nothing
        // unread means no line, even if messages come in while you watch.
        const newest = page.messages[page.messages.length - 1];
        const hasUnread = page.messages.some((m) => m.createdAt > page.myLastReadAt && m.sender?.id !== me.id && m.kind !== "system");
        setReadMarker(newest && hasUnread ? page.myLastReadAt : null);
        setLoaded(true);
        await markRead(activeId);
        refreshList();
      } catch {
        showError(t("failed"));
        setActiveId(null);
      }
    })();
    loadDetail(activeId);
  }, [activeId, loadDetail, refreshList, showError, t, me.id]);

  // Keep ?t= in the URL in step with the open thread, so links can be shared.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (panel?.kind === "thread") url.searchParams.set("t", panel.rootId);
    else url.searchParams.delete("t");
    window.history.replaceState(null, "", url.toString());
  }, [panel]);

  const live = useChatRealtime(me.id, (conversationId) => {
    refreshList();
    if (conversationId === activeRef.current) {
      refreshActive(conversationId);
      loadDetail(conversationId);
      setPanelRefresh((n) => n + 1);
    }
  });

  // Polling fallback: brisk without Pusher, a slow safety net with it.
  useEffect(() => {
    const tick = () => {
      if (document.hidden) return;
      refreshList();
      if (activeRef.current) refreshActive(activeRef.current);
    };
    const handle = setInterval(tick, live ? 30000 : 5000);
    return () => clearInterval(handle);
  }, [live, refreshList, refreshActive]);

  // Member list and presence refresh more slowly.
  useEffect(() => {
    const handle = setInterval(() => {
      if (!document.hidden && activeRef.current) loadDetail(activeRef.current);
    }, 30000);
    return () => clearInterval(handle);
  }, [loadDetail]);

  // Keep the view pinned to the newest message unless the reader scrolled up.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function loadOlder() {
    if (!activeId || messages.length === 0) return;
    const conversationId = activeId;
    const el = scrollRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    try {
      const page = await listMessages(conversationId, { before: messages[0].id });
      if (activeRef.current !== conversationId) return;
      stickToBottom.current = false;
      setMessages((cur) => mergeMessages(cur, page.messages));
      setHasMore(page.hasMore);
      requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight - prevHeight;
      });
    } catch {
      showError(t("failed"));
    }
  }

  const explainError = useCallback(
    (e: unknown) => {
      if (e instanceof ChatUploadError || (e && typeof e === "object" && "status" in e)) {
        const err = e as { status: number; payload: unknown; message: string };
        if (err.status === 429) return showError(t("rateLimited"));
        const payload = err.payload as { reason?: string; fileName?: string } | null;
        if (err.status === 422 && payload?.reason) {
          const key = `reason_${payload.reason}` as Parameters<typeof t>[0];
          return showError(`${t("rejected")}: ${payload.fileName ?? ""} — ${t(key)}`);
        }
      }
      showError(e instanceof Error ? e.message : t("failed"));
    },
    [showError, t]
  );

  async function handleSubmit(input: ComposerSubmit): Promise<boolean> {
    if (!activeId) return false;
    const conversationId = activeId;
    stickToBottom.current = true;
    setReadMarker(null);
    try {
      let message: ChatMessage;
      if (input.kind === "edit") {
        message = await editMessage(input.id, input.body);
        setEditing(null);
      } else if (input.kind === "sticker") {
        message = await sendTextMessage(conversationId, { stickerId: input.stickerId });
      } else if (input.files.length > 0) {
        setUploadProgress(0);
        message = await sendFileMessage(conversationId, { body: input.body, files: input.files }, setUploadProgress);
      } else {
        message = await sendTextMessage(conversationId, { body: input.body });
      }
      // The user may have switched conversation while this was uploading.
      if (activeRef.current === conversationId) setMessages((cur) => mergeMessages(cur, [message]));
      refreshList();
      return true;
    } catch (e) {
      explainError(e);
      return false;
    } finally {
      setUploadProgress(null);
    }
  }

  async function handleDelete(m: ChatMessage) {
    if (!window.confirm(t("confirmDelete"))) return;
    try {
      await deleteMessage(m.id);
      setMessages((cur) => cur.map((x) => (x.id === m.id ? { ...x, deleted: true, body: null, stickerId: null, attachments: [], reactions: [], pinned: false } : x)));
      refreshList();
    } catch (e) {
      explainError(e);
    }
  }

  async function handleReact(m: ChatMessage, emoji: string) {
    try {
      const updated = await toggleReaction(m.id, emoji);
      setMessages((cur) => mergeMessages(cur, [updated]));
    } catch (e) {
      explainError(e);
    }
  }

  async function handlePin(m: ChatMessage) {
    try {
      const updated = await togglePin(m.id);
      setMessages((cur) => mergeMessages(cur, [updated]));
      if (activeId) loadDetail(activeId);
      setPanelRefresh((n) => n + 1);
    } catch (e) {
      explainError(e);
    }
  }

  function jumpTo(id: string) {
    const el = document.getElementById(`msg-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-emerald-300");
    setTimeout(() => el.classList.remove("ring-2", "ring-emerald-300"), 1600);
  }

  function openSearchHit(hit: SearchHit) {
    if (hit.conversationId !== activeId) {
      // A thread hit opens its thread; a channel hit just opens the conversation.
      pendingThread.current = hit.threadRootId;
      setActiveId(hit.conversationId);
    }
    if (hit.threadRootId) setPanel({ kind: "thread", rootId: hit.threadRootId });
    else {
      setPanel(null);
      setTimeout(() => jumpTo(hit.id), 600);
    }
  }

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = conversations ?? [];
    return q ? list.filter((c) => (c.name || "").toLowerCase().includes(q)) : list;
  }, [conversations, filter]);

  const sections: { key: ChatType; label: string; items: ConversationSummary[] }[] = [
    { key: "channel", label: t("channels"), items: filtered.filter((c) => c.type === "channel") },
    { key: "group", label: t("groups"), items: filtered.filter((c) => c.type === "group") },
    { key: "dm", label: t("direct"), items: filtered.filter((c) => c.type === "dm") },
  ];

  const active = conversations?.find((c) => c.id === activeId) ?? null;
  const type = (detail?.type ?? active?.type ?? "group") as ChatType;
  const title = detail?.name ?? active?.name ?? "…";
  const canModerate = detail ? detail.type !== "dm" && (detail.myRole === "owner" || detail.myRole === "admin") : false;
  const dmOther = detail?.type === "dm" ? detail.members.find((m) => m.userId !== me.id) : undefined;
  const dmReadOnly = Boolean(dmOther && !dmOther.active);
  const names = useMemo(() => new Map((detail?.members ?? []).map((m) => [m.userId, m.name])), [detail]);
  const mentionMembers = useMemo(
    () => (detail?.members ?? []).filter((m) => m.userId !== me.id && m.active).map((m) => ({ userId: m.userId, name: m.name, role: m.role })),
    [detail, me.id]
  );
  const lastMine = [...messages].reverse().find((m) => m.sender?.id === me.id && m.kind !== "system" && !m.deleted);
  const lastMineSeen = lastMine ? othersReadAt.some((r) => r >= lastMine.createdAt) : false;
  const firstUnreadId = readMarker
    ? messages.find((m) => m.createdAt > readMarker && m.sender?.id !== me.id && m.kind !== "system")?.id ?? null
    : null;
  const placeholder = `${t("messageTo")} ${type === "channel" ? "#" : ""}${title}`;

  const panelShared = {
    meId: me.id,
    names,
    members: mentionMembers,
    canModerate,
    onError: showError,
    explainError,
    onOpenImage: setLightbox,
    onChanged: () => activeId && refreshActive(activeId),
  };

  return (
    <div className="-m-4 flex h-[calc(100vh-4rem)] flex-col overflow-hidden sm:-m-6 lg:-m-8">
      {/* ── Top bar with search (Slack-style) ── */}
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-slate-800 bg-slate-950 px-3">
        <div className="hidden w-[17rem] shrink-0 items-center gap-2 md:flex">
          <MessagesSquare className="h-4 w-4 text-emerald-400" />
          <span className="text-sm font-bold text-white">{t("title")}</span>
        </div>
        <form
          className="relative mx-auto w-full max-w-2xl"
          onSubmit={(e) => {
            e.preventDefault();
            setPanel({ kind: "search", q: topSearch });
          }}
        >
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={topSearch}
            onChange={(e) => {
              setTopSearch(e.target.value);
              if (e.target.value.trim().length >= 2) setPanel({ kind: "search", q: e.target.value });
            }}
            onFocus={() => topSearch.trim().length >= 2 && setPanel({ kind: "search", q: topSearch })}
            placeholder={t("searchMessages")}
            className="h-8 w-full rounded-md border border-white/10 bg-white/10 pe-3 ps-9 text-sm text-white outline-none placeholder:text-slate-400 focus:border-emerald-400/60 focus:bg-white focus:text-slate-900 focus:placeholder:text-slate-400"
          />
        </form>
        <div className="hidden w-[17rem] shrink-0 md:block" />
      </div>

      <div className="flex min-h-0 flex-1">
        {/* ── Sidebar ── */}
        <aside className={`${activeId ? "hidden md:flex" : "flex"} w-full shrink-0 flex-col bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-slate-300 md:w-72`}>
          <div className="flex items-center gap-2 border-b border-white/5 px-3 py-3">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder={t("search")}
                className="w-full rounded-md border border-white/5 bg-white/5 py-1.5 pe-2 ps-8 text-[13px] text-slate-200 outline-none placeholder:text-slate-500 focus:border-emerald-500/50 focus:bg-white/10"
              />
            </div>
            <button onClick={() => setModal("dm")} className="rounded-md bg-white/5 p-1.5 text-slate-300 ring-1 ring-white/10 transition hover:bg-emerald-500 hover:text-white" title={t("newMessage")}>
              <MessageSquarePlus className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-2 text-[15px]">
            {conversations !== null && conversations.length === 0 && <p className="px-4 py-8 text-center text-sm text-slate-500">{t("noConversations")}</p>}
            {sections.map((s) => (
              <div key={s.key} className="mb-2">
                <div className="group flex items-center gap-1 px-1.5 py-1">
                  <button
                    onClick={() => setCollapsed((c) => ({ ...c, [s.key]: !c[s.key] }))}
                    className="flex flex-1 items-center gap-1 rounded px-1 py-0.5 text-start text-[13px] font-semibold text-slate-400 hover:bg-white/5"
                  >
                    <ChevronDown className={`h-3.5 w-3.5 transition ${collapsed[s.key] ? "-rotate-90 rtl:rotate-90" : ""}`} />
                    {s.label}
                  </button>
                  {(s.key !== "channel" || me.canCreateChannel) && (
                    <button onClick={() => setModal(s.key)} className="rounded p-0.5 text-slate-500 opacity-0 hover:bg-white/10 hover:text-white group-hover:opacity-100" title={s.key === "dm" ? t("newMessage") : s.key === "group" ? t("newGroup") : t("newChannel")}>
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                {!collapsed[s.key] &&
                  s.items.map((c) => {
                    const isActive = c.id === activeId;
                    const unread = c.unread > 0;
                    return (
                      <button
                        key={c.id}
                        onClick={() => setActiveId(c.id)}
                        title={lastMessagePreview(c, t)}
                        className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1 text-start transition ${
                          isActive ? "bg-emerald-600 text-white" : unread ? "text-white hover:bg-white/5" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                        }`}
                      >
                        {c.type === "dm" ? (
                          <span className="relative shrink-0">
                            <Avatar name={c.name} seed={c.otherUser?.id} size={20} />
                            <span className={`absolute -bottom-0.5 -end-0.5 h-2.5 w-2.5 rounded-full ring-2 ${isActive ? "ring-emerald-600" : "ring-slate-900"} ${c.online ? "bg-emerald-400" : "bg-slate-500"}`} />
                          </span>
                        ) : (
                          <span className="flex w-5 shrink-0 justify-center opacity-80">
                            <ConversationIcon type={c.type} isPrivate={c.isPrivate} className="h-4 w-4" />
                          </span>
                        )}
                        <span className={`flex-1 truncate ${unread ? "font-bold" : ""}`}>{c.name}</span>
                        {unread && (
                          <span className={`flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-bold ${isActive ? "bg-white text-emerald-700" : "bg-rose-500 text-white"}`}>
                            {c.unread > 99 ? "99+" : c.unread}
                          </span>
                        )}
                      </button>
                    );
                  })}
                {!collapsed[s.key] && s.key === "channel" && (
                  <button onClick={() => setModal("browse")} className="flex w-full items-center gap-2 rounded-md px-2.5 py-1 text-start text-[14px] text-slate-500 hover:bg-white/5 hover:text-slate-300">
                    <span className="flex w-5 justify-center"><Compass className="h-4 w-4" /></span>
                    {t("browseChannels")}
                  </button>
                )}
              </div>
            ))}
          </div>
        </aside>

        {/* ── Conversation ── */}
        <section className={`${activeId ? "flex" : "hidden md:flex"} min-w-0 flex-1 bg-white`}>
          <div className={`${panel ? "hidden lg:flex" : "flex"} min-w-0 flex-1 flex-col`}>
            {!activeId ? (
              <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 via-white to-emerald-50/40 p-8 text-center">
                <div className="relative mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800 shadow-2xl shadow-slate-900/30">
                  <Sparkles className="h-9 w-9 text-emerald-300" />
                </div>
                <h2 className="relative text-xl font-bold text-slate-900">{t("pickConversation")}</h2>
                <p className="relative mt-2 max-w-sm text-sm text-slate-500">{t("pickConversationHint")}</p>
                <button onClick={() => setModal("dm")} className="relative mt-6 flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 hover:bg-emerald-700">
                  <MessageSquarePlus className="h-4 w-4" />
                  {t("newMessage")}
                </button>
              </div>
            ) : (
              <>
                <header className="flex h-14 shrink-0 items-center gap-2 border-b border-slate-200 px-4">
                  <button onClick={() => setActiveId(null)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 md:hidden">
                    <ArrowRight className="h-5 w-5 ltr:rotate-180" />
                  </button>
                  <button onClick={() => setPanel(panel?.kind === "info" ? null : { kind: "info" })} className="flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 hover:bg-slate-100">
                    {type === "dm" ? (
                      <span className="relative">
                        <Avatar name={title} seed={dmOther?.userId} size={24} />
                        <span className={`absolute -bottom-0.5 -end-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white ${dmOther?.online ? "bg-emerald-500" : "bg-slate-300"}`} />
                      </span>
                    ) : (
                      <ConversationIcon type={type} isPrivate={detail?.isPrivate ?? active?.isPrivate ?? true} className="h-4 w-4 text-slate-600" />
                    )}
                    <h2 className="truncate text-[17px] font-bold text-slate-900">{title}</h2>
                    <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
                  </button>
                  {type === "dm" && dmOther && <span className="text-xs text-slate-500">{dmOther.online ? t("online") : t("offline")}</span>}
                  {type !== "dm" && detail?.description && <span className="hidden truncate border-s border-slate-200 ps-3 text-sm text-slate-500 lg:block">{detail.description}</span>}

                  <div className="ms-auto flex items-center gap-1">
                    {type !== "dm" && detail && (
                      <button onClick={() => setPanel(panel?.kind === "info" ? null : { kind: "info" })} className="flex items-center gap-1.5 rounded-md border border-slate-200 py-1 pe-2 ps-1 hover:bg-slate-50" title={t("info")}>
                        <span className="flex -space-x-1.5 rtl:space-x-reverse">
                          {detail.members.slice(0, 3).map((m) => (
                            <span key={m.userId} className="rounded-md ring-2 ring-white">
                              <Avatar name={m.name} seed={m.userId} size={20} />
                            </span>
                          ))}
                        </span>
                        <span className="text-xs font-semibold text-slate-600">{detail.members.length}</span>
                      </button>
                    )}
                    <button
                      onClick={() => setPanel(panel?.kind === "pins" ? null : { kind: "pins" })}
                      className={`flex items-center gap-1 rounded-md p-1.5 text-sm transition ${panel?.kind === "pins" ? "bg-amber-50 text-amber-700" : "text-slate-500 hover:bg-slate-100"}`}
                      title={t("pinnedMessages")}
                    >
                      <Pin className="h-4 w-4" />
                      {detail && detail.pinnedCount > 0 && <span className="text-xs font-semibold">{detail.pinnedCount}</span>}
                    </button>
                    <button
                      onClick={() => setPanel(panel?.kind === "info" ? null : { kind: "info" })}
                      className={`rounded-md p-1.5 transition ${panel?.kind === "info" ? "bg-emerald-50 text-emerald-700" : "text-slate-500 hover:bg-slate-100"}`}
                      title={t("info")}
                    >
                      <Info className="h-4 w-4" />
                    </button>
                  </div>
                </header>

                <div
                  ref={scrollRef}
                  onScroll={(e) => {
                    const el = e.currentTarget;
                    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
                  }}
                  className="flex-1 overflow-y-auto pb-4"
                >
                  {hasMore && (
                    <div className="my-3 flex justify-center">
                      <button onClick={loadOlder} className="rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50">
                        {t("loadOlder")}
                      </button>
                    </div>
                  )}
                  {loaded && !hasMore && (
                    <div className="px-5 pb-2 pt-8">
                      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                        {type === "dm" ? <Avatar name={title} seed={dmOther?.userId} size={56} /> : <ConversationIcon type={type} isPrivate={detail?.isPrivate ?? true} className="h-7 w-7" />}
                      </div>
                      <h3 className="text-2xl font-black text-slate-900">
                        {type === "dm" ? title : `${type === "channel" ? "#" : ""}${title}`}
                      </h3>
                      <p className="mt-1 text-[15px] text-slate-600">
                        {type === "dm" ? `${t("dmStart")} ${title}.` : `${t("channelStart")} ${type === "channel" ? "#" : ""}${title}. ${detail?.description ?? t("channelStartHint")}`}
                      </p>
                    </div>
                  )}
                  {messages.map((m, i) => {
                    const prev = messages[i - 1];
                    const newDay = !prev || new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString();
                    const isFirstUnread = m.id === firstUnreadId;
                    const grouped =
                      !newDay &&
                      !isFirstUnread &&
                      prev &&
                      prev.kind !== "system" &&
                      m.kind !== "system" &&
                      !prev.thread &&
                      prev.sender?.id === m.sender?.id &&
                      new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60 * 1000;
                    return (
                      <div key={m.id}>
                        {newDay && (
                          <div className="sticky top-0 z-[5] my-2 flex items-center gap-3 px-4">
                            <div className="h-px flex-1 bg-slate-200" />
                            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[12px] font-bold text-slate-700 shadow-sm">{dayLabel(m.createdAt, locale, t)}</span>
                            <div className="h-px flex-1 bg-slate-200" />
                          </div>
                        )}
                        {isFirstUnread && (
                          <div className="my-1 flex items-center gap-2 px-4">
                            <div className="h-px flex-1 bg-rose-400" />
                            <span className="text-[11px] font-bold uppercase text-rose-500">{t("newMessages")}</span>
                          </div>
                        )}
                        <MessageItem
                          message={m}
                          meId={me.id}
                          names={names}
                          grouped={Boolean(grouped)}
                          canModerate={canModerate}
                          seen={lastMineSeen}
                          isLastMine={lastMine?.id === m.id}
                          onOpenThread={(x) => setPanel({ kind: "thread", rootId: x.id })}
                          onEdit={setEditing}
                          onDelete={handleDelete}
                          onReact={handleReact}
                          onPin={handlePin}
                          onOpenImage={setLightbox}
                        />
                      </div>
                    );
                  })}
                </div>
                {dmReadOnly ? (
                  <div className="border-t border-slate-200 bg-slate-50 px-4 py-4 text-center text-sm text-slate-500">{t("readOnlyDm")}</div>
                ) : (
                  <Composer
                    // Remounting per conversation drops any draft and attached
                    // files, so they can never be sent to the wrong people.
                    key={activeId}
                    editing={editing}
                    uploadProgress={uploadProgress}
                    members={mentionMembers}
                    names={names}
                    placeholder={placeholder}
                    onCancelEdit={() => setEditing(null)}
                    onSubmit={handleSubmit}
                    onError={showError}
                  />
                )}
              </>
            )}
          </div>

          {panel?.kind === "info" && detail && (
            <InfoPanel
              detail={detail}
              meId={me.id}
              onClose={() => setPanel(null)}
              onChanged={() => {
                loadDetail(detail.id);
                refreshActive(detail.id);
                refreshList();
              }}
              onLeft={() => {
                setPanel(null);
                setActiveId(null);
                refreshList();
              }}
              onError={showError}
            />
          )}
          {panel?.kind === "thread" && activeId && (
            <ThreadPanel
              {...panelShared}
              rootId={panel.rootId}
              conversationName={type === "channel" ? `#${title}` : title}
              refreshKey={panelRefresh}
              readOnly={dmReadOnly}
              live={live}
              onClose={() => setPanel(null)}
            />
          )}
          {panel?.kind === "pins" && activeId && (
            <PinsPanel
              {...panelShared}
              conversationId={activeId}
              refreshKey={panelRefresh}
              onClose={() => setPanel(null)}
              onJump={(m) => (m.threadRootId ? setPanel({ kind: "thread", rootId: m.threadRootId }) : jumpTo(m.id))}
            />
          )}
          {panel?.kind === "search" && <SearchPanel initialQuery={panel.q} onClose={() => setPanel(null)} onOpen={openSearchHit} />}
        </section>
      </div>

      {modal && modal !== "browse" && (
        <NewConversationModal
          type={modal}
          onClose={() => setModal(null)}
          onError={showError}
          onCreated={(id) => {
            setModal(null);
            refreshList();
            setActiveId(id);
          }}
        />
      )}
      {modal === "browse" && (
        <BrowseChannelsModal
          onClose={() => setModal(null)}
          onError={showError}
          onOpen={(id) => {
            setModal(null);
            refreshList();
            setActiveId(id);
          }}
        />
      )}
      {lightbox && <ImageLightbox attachment={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}
