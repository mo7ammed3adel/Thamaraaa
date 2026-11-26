"use client";

import { useEffect, useState } from "react";
import { Link2, Route, Search, Unlink } from "lucide-react";
import { linkConversationClient, searchLinkableProjects, type ConversationDetail, type LinkableProject } from "@/client/api/chat";
import { useChatT } from "./useChatT";

/**
 * "Client" block in a group's info panel: open the client's journey, and for
 * owners/admins of a regular group, link it to a client (or unlink it).
 */
export function ClientLinkSection({
  detail,
  canManage,
  onOpenJourney,
  onChanged,
  onError,
}: {
  detail: ConversationDetail;
  canManage: boolean;
  onOpenJourney: () => void;
  onChanged: () => void;
  onError: (m: string) => void;
}) {
  const { t } = useChatT();
  const [picking, setPicking] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<LinkableProject[]>([]);
  const canLink = canManage && detail.type === "group" && !detail.isClientGroup;

  useEffect(() => {
    if (!picking) return;
    const handle = setTimeout(() => {
      searchLinkableProjects(q).then(setResults).catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(handle);
  }, [q, picking]);

  if (detail.type === "dm" || (!detail.journeyProjectId && !canLink)) return null;

  async function link(projectId: string | null) {
    try {
      await linkConversationClient(detail.id, projectId);
      setPicking(false);
      setQ("");
      onChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : t("failed"));
    }
  }

  return (
    <div className="mb-5 rounded-xl border border-slate-200 p-3" data-testid="client-link">
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">{t("journeyClient")}</p>
      {detail.journeyProjectId && (
        <div className="flex gap-2">
          <button onClick={onOpenJourney} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white hover:bg-emerald-700" data-testid="open-journey">
            <Route className="h-4 w-4" /> {t("clientJourney")}
          </button>
          {canLink && (
            <button onClick={() => link(null)} className="rounded-lg px-2.5 text-slate-500 ring-1 ring-slate-200 hover:bg-rose-50 hover:text-rose-600" title={t("unlinkClient")} data-testid="unlink-client">
              <Unlink className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
      {canLink && !detail.journeyProjectId && !picking && (
        <button onClick={() => setPicking(true)} className="flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-50" data-testid="link-client">
          <Link2 className="h-4 w-4" /> {t("linkClient")}
        </button>
      )}
      {picking && (
        <div>
          <div className="relative">
            <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchClients")} className="w-full rounded-lg border border-slate-200 py-1.5 pe-2 ps-8 text-sm outline-none focus:border-emerald-300" data-testid="client-search" />
          </div>
          <div className="mt-2 max-h-56 space-y-1 overflow-y-auto">
            {results.map((p) => (
              <button key={p.id} onClick={() => link(p.id)} className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-start text-sm hover:bg-slate-50" data-testid="client-option">
                <span className="truncate font-medium text-slate-800">{p.clientName}</span>
                <span className="shrink-0 text-[11px] text-slate-400">{p.package}</span>
              </button>
            ))}
          </div>
          <button onClick={() => setPicking(false)} className="mt-2 w-full rounded-lg py-1.5 text-xs text-slate-500 hover:bg-slate-100">
            {t("cancel")}
          </button>
        </div>
      )}
    </div>
  );
}
