"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CornerDownLeft, Download, ExternalLink, FileArchive, FileText, File as FileIcon, Film, Images, Link2, Loader2, Play } from "lucide-react";
import {
  attachmentThumbUrl,
  attachmentUrl,
  listConversationMedia,
  type ChatAttachment,
  type MediaAttachmentItem,
  type MediaItem,
  type MediaLinkItem,
  type MediaTab,
} from "@/client/api/chat";
import { formatBytes } from "@/lib/chat/constants";
import { PanelShell } from "./SidePanels";
import { useChatT } from "./useChatT";

const TABS: { key: MediaTab; icon: typeof Images }[] = [
  { key: "image", icon: Images },
  { key: "video", icon: Film },
  { key: "file", icon: FileText },
  { key: "link", icon: Link2 },
];

/** Month headings, WhatsApp-style. */
function monthLabel(iso: string, locale: string) {
  return new Date(iso).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US", { month: "long", year: "numeric" });
}

function groupByMonth(items: MediaItem[], locale: string) {
  const groups: { label: string; items: MediaItem[] }[] = [];
  for (const item of items) {
    const label = monthLabel(item.createdAt, locale);
    if (groups[groups.length - 1]?.label !== label) groups.push({ label, items: [] });
    groups[groups.length - 1].items.push(item);
  }
  return groups;
}

/**
 * Everything shared in a conversation, by type: photos, videos, files and
 * links, to find a thing fast. Each item can jump back to its message.
 */
export function MediaPanel({
  conversationId,
  refreshKey,
  onClose,
  onOpenImage,
  onJump,
}: {
  conversationId: string;
  refreshKey: number;
  onClose: () => void;
  onOpenImage: (a: ChatAttachment) => void;
  onJump: (messageId: string, threadRootId: string | null) => void;
}) {
  const { t, locale } = useChatT();
  const [tab, setTab] = useState<MediaTab>("image");
  // Items are kept with the tab they were loaded for: right after switching,
  // the old tab's items must never be drawn with the new tab's layout.
  const [loaded, setLoaded] = useState<{ tab: MediaTab; items: MediaItem[] } | null>(null);
  const items = loaded?.tab === tab ? loaded.items : null;
  const setItems = useCallback(
    (next: MediaItem[] | null | ((cur: MediaItem[] | null) => MediaItem[] | null), forTab: MediaTab) =>
      setLoaded((cur) => {
        const prev = cur?.tab === forTab ? cur.items : null;
        const value = typeof next === "function" ? next(prev) : next;
        return value ? { tab: forTab, items: value } : null;
      }),
    []
  );
  const [counts, setCounts] = useState<Record<MediaTab, number> | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  /** Bumped per tab/load, so a late response never lands in another tab. */
  const generation = useRef(0);

  const load = useCallback(async () => {
    const mine = ++generation.current;
    try {
      const page = await listConversationMedia(conversationId, tab);
      if (mine !== generation.current) return;
      setItems(page.items, tab);
      if (page.counts) setCounts(page.counts);
      setHasMore(page.hasMore);
      setCursor(page.nextCursor);
    } catch {
      // Keep what is on screen (e.g. briefly rate-limited); empty only on first load.
      if (mine === generation.current) setItems((cur) => cur ?? [], tab);
    }
  }, [conversationId, tab, setItems]);

  useEffect(() => {
    load();
  }, [load]);

  // New uploads appear without reopening the panel — debounced, since busy
  // conversations fire many events (reactions, typing of others…).
  useEffect(() => {
    if (refreshKey === 0) return;
    const handle = setTimeout(load, 1500);
    return () => clearTimeout(handle);
  }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadMore() {
    if (!items || !cursor || loadingMore) return;
    setLoadingMore(true);
    const mine = generation.current;
    try {
      const page = await listConversationMedia(conversationId, tab, cursor);
      if (mine !== generation.current) return;
      setItems((cur) => {
        const seen = new Set((cur ?? []).map((i) => i.id));
        return [...(cur ?? []), ...page.items.filter((i) => !seen.has(i.id))];
      }, tab);
      setHasMore(page.hasMore);
      setCursor(page.nextCursor);
    } catch {
      /* try again later */
    } finally {
      setLoadingMore(false);
    }
  }

  const label = (k: MediaTab) => (k === "image" ? t("mediaPhotos") : k === "video" ? t("mediaVideos") : k === "file" ? t("mediaFiles") : t("mediaLinks"));
  const jump = (m: MediaItem) => onJump(m.messageId, m.threadRootId);

  return (
    <PanelShell title={t("sharedMedia")} icon={<Images className="h-5 w-5" />} onClose={onClose}>
      <div className="flex shrink-0 gap-1 border-b border-slate-200 px-2 pt-2" role="tablist">
        {TABS.map(({ key, icon: Icon }) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            data-testid={`media-tab-${key}`}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-t-lg border-b-2 px-2 py-2 text-[13px] font-semibold transition ${
              tab === key ? "border-emerald-600 text-emerald-700" : "border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-700"
            }`}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{label(key)}</span>
            {counts && counts[key] > 0 && <span className="rounded-full bg-slate-100 px-1.5 text-[10px] text-slate-500">{counts[key]}</span>}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3" data-testid={`media-list-${tab}`}>
        {items === null && (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
          </div>
        )}
        {items?.length === 0 && (
          <div className="px-4 py-12 text-center">
            <Images className="mx-auto mb-3 h-8 w-8 text-slate-300" />
            <p className="text-sm font-semibold text-slate-700">{t("noMedia")}</p>
          </div>
        )}

        {items &&
          groupByMonth(items, locale).map((g) => (
            <section key={g.label} className="mb-4">
              <h4 className="mb-2 px-1 text-xs font-bold text-slate-500">{g.label}</h4>

              {(tab === "image" || tab === "video") && (
                <div className="grid grid-cols-3 gap-1">
                  {(g.items as MediaAttachmentItem[]).map((m) =>
                    tab === "image" ? (
                      <button key={m.id} onClick={() => onOpenImage(m)} className="group relative aspect-square overflow-hidden rounded-md bg-slate-100" data-testid="media-item">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={attachmentThumbUrl(m.id)} alt={m.originalName} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
                      </button>
                    ) : (
                      <a key={m.id} href={attachmentUrl(m.id)} target="_blank" rel="noopener noreferrer" className="group relative aspect-square overflow-hidden rounded-md bg-slate-900" data-testid="media-item">
                        <video src={attachmentUrl(m.id)} preload="none" muted playsInline className="h-full w-full object-cover opacity-90" />
                        <span className="absolute inset-0 flex items-center justify-center">
                          <span className="rounded-full bg-black/50 p-2 text-white">
                            <Play className="h-4 w-4 fill-current" />
                          </span>
                        </span>
                      </a>
                    )
                  )}
                </div>
              )}

              {tab === "file" && (
                <div className="space-y-1.5">
                  {(g.items as MediaAttachmentItem[]).map((m) => {
                    const Icon = m.category === "pdf" || m.category === "document" ? FileText : m.category === "archive" ? FileArchive : FileIcon;
                    return (
                      <div key={m.id} className="flex items-center gap-3 rounded-lg border border-slate-200 p-2.5 hover:border-slate-300" data-testid="media-item">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                          <Icon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-800" title={m.originalName}>{m.originalName}</p>
                          <p className="text-[11px] text-slate-500">
                            {formatBytes(m.size)} · {m.sender?.name ?? "—"}
                          </p>
                        </div>
                        <button onClick={() => jump(m)} title={t("goToMessage")} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                          <CornerDownLeft className="h-4 w-4" />
                        </button>
                        <a href={attachmentUrl(m.id, true)} title={t("download")} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                          <Download className="h-4 w-4" />
                        </a>
                      </div>
                    );
                  })}
                </div>
              )}

              {tab === "link" && (
                <div className="space-y-1.5">
                  {(g.items as MediaLinkItem[]).map((m) => (
                    <div key={m.id} className="flex items-center gap-3 rounded-lg border border-slate-200 p-2.5 hover:border-slate-300" data-testid="media-item">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
                        <Link2 className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <a href={m.url} target="_blank" rel="noopener noreferrer nofollow" className="block truncate text-sm font-medium text-sky-700 hover:underline" title={m.url} dir="ltr">
                          {m.url.replace(/^https?:\/\/(www\.)?/, "")}
                        </a>
                        <p className="text-[11px] text-slate-500">
                          {m.host} · {m.sender?.name ?? "—"}
                        </p>
                      </div>
                      <button onClick={() => jump(m)} title={t("goToMessage")} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                        <CornerDownLeft className="h-4 w-4" />
                      </button>
                      <a href={m.url} target="_blank" rel="noopener noreferrer nofollow" title={t("open")} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))}

        {hasMore && (
          <div className="flex justify-center py-2">
            <button onClick={loadMore} disabled={loadingMore} className="rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-50">
              {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : t("loadMore")}
            </button>
          </div>
        )}
      </div>
    </PanelShell>
  );
}
