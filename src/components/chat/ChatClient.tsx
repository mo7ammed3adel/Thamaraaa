"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Compass, Hash, Info, MessageSquarePlus, MessagesSquare, Plus, Search, Sparkles, Users } from "lucide-react";
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
  type ChatAttachment,
  type ChatMessage,
  type ChatType,
  type ConversationDetail,
  type ConversationSummary,
} from "@/client/api/chat";
import { findSticker } from "@/lib/chat/constants";
import { notify } from "@/components/toast";
import { Avatar, ConversationIcon } from "./ChatBits";
import Composer, { type ComposerSubmit } from "./Composer";
import MessageItem, { ImageLightbox, formatTime } from "./MessageItem";
import { BrowseChannelsModal, InfoPanel, NewConversationModal } from "./ChatModals";
import { useChatT } from "./useChatT";

type Me = { id: string; name: string; canCreateChannel: boolean };

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

function lastMessagePreview(c: ConversationSummary, t: ReturnType<typeof useChatT>["t"], locale: "ar" | "en") {
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
  const [othersReadAt, setOthersReadAt] = useState<string[]>([]);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [modal, setModal] = useState<ChatType | "browse" | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [filter, setFilter] = useState("");
  const [lightbox, setLightbox] = useState<ChatAttachment | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const activeRef = useRef<string | null>(null);
  activeRef.current = activeId;

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

  // Initial load + open from ?c= in the URL.
  useEffect(() => {
    refreshList();
    const fromUrl = new URLSearchParams(window.location.search).get("c");
    if (fromUrl) setActiveId(fromUrl);
  }, [refreshList]);

  // Switching conversation.
  useEffect(() => {
    setMessages([]);
    setDetail(null);
    setReplyTo(null);
    setEditing(null);
    setHasMore(false);
    if (!activeId) return;
    stickToBottom.current = true;
    const url = new URL(window.location.href);
    url.searchParams.set("c", activeId);
    window.history.replaceState(null, "", url.toString());
    (async () => {
      try {
        const page = await listMessages(activeId);
        if (activeRef.current !== activeId) return;
        setMessages(page.messages);
        setHasMore(page.hasMore);
        setOthersReadAt(page.othersReadAt);
        await markRead(activeId);
        refreshList();
      } catch {
        showError(t("failed"));
        setActiveId(null);
      }
    })();
    loadDetail(activeId);
  }, [activeId, loadDetail, refreshList, showError, t]);

  const live = useChatRealtime(me.id, (conversationId) => {
    refreshList();
    if (conversationId === activeRef.current) {
      refreshActive(conversationId);
      loadDetail(conversationId);
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

  function explainError(e: unknown) {
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
  }

  async function handleSubmit(input: ComposerSubmit): Promise<boolean> {
    if (!activeId) return false;
    const conversationId = activeId;
    stickToBottom.current = true;
    try {
      let message: ChatMessage;
      if (input.kind === "edit") {
        message = await editMessage(input.id, input.body);
        setEditing(null);
      } else if (input.kind === "sticker") {
        message = await sendTextMessage(activeId, { stickerId: input.stickerId, replyToId: replyTo?.id });
        setReplyTo(null);
      } else if (input.files.length > 0) {
        setUploadProgress(0);
        message = await sendFileMessage(activeId, { body: input.body, replyToId: replyTo?.id, files: input.files }, setUploadProgress);
        setReplyTo(null);
      } else {
        message = await sendTextMessage(activeId, { body: input.body, replyToId: replyTo?.id });
        setReplyTo(null);
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
      setMessages((cur) => cur.map((x) => (x.id === m.id ? { ...x, deleted: true, body: null, stickerId: null, attachments: [], reactions: [] } : x)));
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

  function jumpTo(id: string) {
    const el = document.getElementById(`msg-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-emerald-300");
    setTimeout(() => el.classList.remove("ring-2", "ring-emerald-300"), 1500);
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
  const canModerate = detail ? detail.type !== "dm" && (detail.myRole === "owner" || detail.myRole === "admin") : false;
  const dmReadOnly = detail?.type === "dm" && detail.members.some((m) => m.userId !== me.id && !m.active);
  const lastMine = [...messages].reverse().find((m) => m.sender?.id === me.id && m.kind !== "system" && !m.deleted);
  const lastMineSeen = lastMine ? othersReadAt.some((r) => r >= lastMine.createdAt) : false;

  return (
    <div className="-m-4 flex h-[calc(100vh-4rem)] overflow-hidden sm:-m-6 lg:-m-8">
      {/* ── Conversation list ── */}
      <aside className={`${activeId ? "hidden md:flex" : "flex"} w-full shrink-0 flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-300 md:w-80`}>
        <div className="border-b border-white/5 px-4 pb-3 pt-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 shadow-lg shadow-emerald-500/20">
              <MessagesSquare className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-base font-bold text-white">{t("title")}</h1>
              <p className="text-xs text-slate-400">{t("subtitle")}</p>
            </div>
            <button onClick={() => setModal("dm")} className="rounded-xl bg-white/5 p-2 text-slate-300 ring-1 ring-white/10 transition hover:bg-emerald-500 hover:text-white" title={t("newMessage")}>
              <MessageSquarePlus className="h-5 w-5" />
            </button>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={t("search")}
              className="w-full rounded-xl border border-white/5 bg-white/5 py-2 pe-3 ps-9 text-sm text-slate-200 outline-none placeholder:text-slate-500 focus:border-emerald-500/50 focus:bg-white/10"
            />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-1.5 text-[11px] font-semibold">
            <button onClick={() => setModal("group")} className="flex flex-col items-center gap-1 rounded-xl bg-white/5 py-2 ring-1 ring-white/5 transition hover:bg-white/10 hover:text-white">
              <Users className="h-4 w-4 text-sky-300" />
              {t("newGroup")}
            </button>
            {me.canCreateChannel ? (
              <button onClick={() => setModal("channel")} className="flex flex-col items-center gap-1 rounded-xl bg-white/5 py-2 ring-1 ring-white/5 transition hover:bg-white/10 hover:text-white">
                <Hash className="h-4 w-4 text-emerald-300" />
                {t("newChannel")}
              </button>
            ) : (
              <div />
            )}
            <button onClick={() => setModal("browse")} className="flex flex-col items-center gap-1 rounded-xl bg-white/5 py-2 ring-1 ring-white/5 transition hover:bg-white/10 hover:text-white">
              <Compass className="h-4 w-4 text-amber-300" />
              {t("browseChannels")}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2">
          {conversations !== null && conversations.length === 0 && <p className="px-4 py-8 text-center text-sm text-slate-500">{t("noConversations")}</p>}
          {sections.map(
            (s) =>
              s.items.length > 0 && (
                <div key={s.key} className="mb-3">
                  <div className="flex items-center justify-between px-3 pb-1 pt-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{s.label}</span>
                    {(s.key !== "channel" || me.canCreateChannel) && (
                      <button onClick={() => setModal(s.key)} className="rounded p-0.5 text-slate-500 hover:bg-white/10 hover:text-white">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  {s.items.map((c) => {
                    const isActive = c.id === activeId;
                    const preview = lastMessagePreview(c, t, locale);
                    return (
                      <button
                        key={c.id}
                        onClick={() => setActiveId(c.id)}
                        className={`group flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-start transition ${
                          isActive ? "bg-gradient-to-r from-emerald-500/20 to-teal-500/5 ring-1 ring-emerald-500/30" : "hover:bg-white/5"
                        }`}
                      >
                        {c.type === "dm" ? (
                          <Avatar name={c.name} seed={c.otherUser?.id} size={38} />
                        ) : (
                          <div className={`flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl ${isActive ? "bg-emerald-500/20 text-emerald-300" : "bg-white/5 text-slate-400"}`}>
                            <ConversationIcon type={c.type} isPrivate={c.isPrivate} />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`truncate text-sm ${c.unread ? "font-bold text-white" : isActive ? "font-semibold text-white" : "font-medium text-slate-200"}`}>{c.name}</span>
                            {c.lastMessage && <span className="shrink-0 text-[10px] text-slate-500">{formatTime(c.lastMessageAt, locale)}</span>}
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className={`truncate text-xs ${c.unread ? "text-slate-300" : "text-slate-500"}`} dir="auto">{preview || " "}</span>
                            {c.unread > 0 && (
                              <span className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 px-1.5 text-[10px] font-bold text-white shadow shadow-emerald-500/40">
                                {c.unread > 99 ? "99+" : c.unread}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )
          )}
        </div>
      </aside>

      {/* ── Conversation ── */}
      <section className={`${activeId ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col bg-white`}>
        {!activeId ? (
          <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 via-white to-emerald-50/40 p-8 text-center">
            <div className="pointer-events-none absolute -end-24 -top-24 h-72 w-72 rounded-full bg-emerald-200/30 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -start-24 h-72 w-72 rounded-full bg-amber-200/30 blur-3xl" />
            <div className="relative mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800 shadow-2xl shadow-slate-900/30">
              <Sparkles className="h-9 w-9 text-emerald-300" />
            </div>
            <h2 className="relative text-xl font-bold text-slate-900">{t("pickConversation")}</h2>
            <p className="relative mt-2 max-w-sm text-sm text-slate-500">{t("pickConversationHint")}</p>
            <button onClick={() => setModal("dm")} className="relative mt-6 flex items-center gap-2 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 hover:brightness-110">
              <MessageSquarePlus className="h-4 w-4" />
              {t("newMessage")}
            </button>
          </div>
        ) : (
          <>
            <header className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 bg-white/80 px-4 backdrop-blur">
              <button onClick={() => setActiveId(null)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 md:hidden">
                <ArrowRight className="h-5 w-5 ltr:rotate-180" />
              </button>
              {active?.type === "dm" || detail?.type === "dm" ? (
                <Avatar name={detail?.name ?? active?.name} seed={active?.otherUser?.id} size={38} />
              ) : (
                <div className="flex h-[38px] w-[38px] items-center justify-center rounded-xl bg-gradient-to-br from-slate-800 to-slate-950 text-emerald-300">
                  <ConversationIcon type={(detail?.type ?? active?.type ?? "group") as ChatType} isPrivate={detail?.isPrivate ?? active?.isPrivate ?? true} />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-[15px] font-bold text-slate-900">{detail?.name ?? active?.name ?? "…"}</h2>
                <p className="truncate text-xs text-slate-500">
                  {detail?.type === "dm"
                    ? detail.members.find((m) => m.userId !== me.id)?.role.replace(/_/g, " ")
                    : `${detail?.members.length ?? active?.memberCount ?? 0} ${t("members")}${detail?.description ? ` · ${detail.description}` : ""}`}
                </p>
              </div>
              <button
                onClick={() => setShowInfo((v) => !v)}
                className={`rounded-xl p-2 transition ${showInfo ? "bg-emerald-50 text-emerald-700" : "text-slate-500 hover:bg-slate-100"}`}
                title={t("info")}
              >
                <Info className="h-5 w-5" />
              </button>
            </header>

            <div className="flex min-h-0 flex-1">
              <div className="flex min-w-0 flex-1 flex-col">
                <div
                  ref={scrollRef}
                  onScroll={(e) => {
                    const el = e.currentTarget;
                    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
                  }}
                  className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_1px_1px,rgb(226_232_240/0.6)_1px,transparent_0)] bg-[length:22px_22px] px-2 py-4"
                >
                  {hasMore && (
                    <div className="mb-2 flex justify-center">
                      <button onClick={loadOlder} className="rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50">
                        {t("loadOlder")}
                      </button>
                    </div>
                  )}
                  {messages.map((m, i) => {
                    const prev = messages[i - 1];
                    const newDay = !prev || new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString();
                    const grouped =
                      !newDay &&
                      prev &&
                      prev.kind !== "system" &&
                      m.kind !== "system" &&
                      prev.sender?.id === m.sender?.id &&
                      new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60 * 1000;
                    return (
                      <div key={m.id}>
                        {newDay && (
                          <div className="my-4 flex items-center gap-3 px-4">
                            <div className="h-px flex-1 bg-slate-200" />
                            <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-slate-500 shadow-sm ring-1 ring-slate-200">{dayLabel(m.createdAt, locale, t)}</span>
                            <div className="h-px flex-1 bg-slate-200" />
                          </div>
                        )}
                        <MessageItem
                          message={m}
                          meId={me.id}
                          grouped={Boolean(grouped)}
                          canModerate={canModerate}
                          seen={lastMineSeen}
                          isLastMine={lastMine?.id === m.id}
                          onReply={(x) => {
                            setEditing(null);
                            setReplyTo(x);
                          }}
                          onEdit={(x) => {
                            setReplyTo(null);
                            setEditing(x);
                          }}
                          onDelete={handleDelete}
                          onReact={handleReact}
                          onOpenImage={setLightbox}
                          onJumpTo={jumpTo}
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
                    replyTo={replyTo}
                    editing={editing}
                    uploadProgress={uploadProgress}
                    onCancelReply={() => setReplyTo(null)}
                    onCancelEdit={() => setEditing(null)}
                    onSubmit={handleSubmit}
                    onError={showError}
                  />
                )}
              </div>
              {showInfo && detail && (
                <InfoPanel
                  detail={detail}
                  meId={me.id}
                  onClose={() => setShowInfo(false)}
                  onChanged={() => {
                    loadDetail(detail.id);
                    refreshActive(detail.id);
                    refreshList();
                  }}
                  onLeft={() => {
                    setShowInfo(false);
                    setActiveId(null);
                    refreshList();
                  }}
                  onError={showError}
                />
              )}
            </div>
          </>
        )}
      </section>

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
