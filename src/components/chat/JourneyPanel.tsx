"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2, Route } from "lucide-react";
import { getConversationJourney, type ConversationJourney } from "@/client/api/chat";
import { PanelShell } from "./SidePanels";
import { useChatT } from "./useChatT";

/** The group's client, and its journey (same timeline as the client page). */
export function JourneyPanel({ conversationId, refreshKey, onClose }: { conversationId: string; refreshKey: number; onClose: () => void }) {
  const { t, locale } = useChatT();
  const [journey, setJourney] = useState<ConversationJourney | null | undefined>(undefined);

  useEffect(() => {
    let live = true;
    getConversationJourney(conversationId)
      .then((r) => live && setJourney(r.journey))
      .catch(() => live && setJourney((cur) => cur ?? null));
    return () => {
      live = false;
    };
  }, [conversationId, refreshKey]);

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(locale === "ar" ? "ar-EG" : "en-US", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

  return (
    <PanelShell title={t("clientJourney")} subtitle={journey?.clientName} icon={<Route className="h-5 w-5" />} onClose={onClose}>
      <div className="flex-1 overflow-y-auto p-4" data-testid="journey-panel">
        {journey === undefined && (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
          </div>
        )}
        {journey === null && <p className="py-10 text-center text-sm text-slate-500">{t("noJourney")}</p>}
        {journey && (
          <>
            <div className="mb-4 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-3">
              <p className="text-base font-bold text-slate-900">{journey.clientName}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px]">
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700 ring-1 ring-emerald-200">{journey.package}</span>
                {journey.projectStatus && <span className="rounded-full bg-sky-50 px-2 py-0.5 font-semibold capitalize text-sky-700 ring-1 ring-sky-200">{journey.projectStatus.replace(/_/g, " ")}</span>}
                {journey.lifecycleState && <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">{journey.lifecycleState}</span>}
              </div>
              {journey.accountManager && <p className="mt-2 text-xs text-slate-500">AM: {journey.accountManager}</p>}
              {journey.limited && <p className="mt-2 text-[11px] text-amber-700" data-testid="journey-limited">{t("journeyLimited")}</p>}
              {journey.canOpenClientPage && (
                <Link href={`/dashboard/clients/${journey.projectId}`} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700" data-testid="journey-open-client">
                  <ExternalLink className="h-3.5 w-3.5" /> {t("openClientPage")}
                </Link>
              )}
            </div>

            {journey.timeline.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">{t("noJourney")}</p>
            ) : (
              <ol className="relative ms-2 border-s-2 border-slate-200" data-testid="journey-timeline">
                {[...journey.timeline].reverse().map((e, i) => (
                  <li key={`${e.date}-${i}`} className="mb-4 ms-4">
                    <span className={`absolute -start-[7px] mt-1.5 h-3 w-3 rounded-full ring-2 ring-white ${e.color || "bg-slate-400"}`} />
                    <p className="text-sm font-semibold text-slate-800">{e.label}</p>
                    <p className="text-[11px] text-slate-400">{fmt(e.date)}</p>
                    {(e.agent || e.role) && (
                      <p className="text-xs text-slate-600">
                        {e.agent}
                        {e.role ? <span className="text-slate-400"> · {e.role}</span> : null}
                      </p>
                    )}
                    {e.detail && <p className="mt-0.5 whitespace-pre-wrap break-words text-xs text-slate-500" dir="auto">{e.detail}</p>}
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
      </div>
    </PanelShell>
  );
}
