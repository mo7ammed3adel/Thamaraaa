import type { ClientJourneyTimelineEntry } from "@/lib/clientJourneyTimeline";
import { useTranslator } from "@/components/i18n/LocaleProvider";

type ClientTimelineTabProps = {
  timeline: ClientJourneyTimelineEntry[];
};

export default function ClientTimelineTab({ timeline }: ClientTimelineTabProps) {
  const t = useTranslator();
  return (
    <div className="bg-white rounded-xl border shadow-sm p-6">
      <h2 className="text-lg font-bold text-slate-800 mb-4">{t("journey.timelineTitle")}</h2>
      {timeline.length === 0 ? (
        <p className="text-sm text-slate-400 italic">{t("empty.noJourneyYet")}</p>
      ) : (
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200" />
          <div className="space-y-3">
            {timeline.map((entry, index) => (
              <div key={`${entry.stage}-${entry.label}-${index}`} className="relative ps-10">
                <div className={`absolute left-2.5 top-3 w-3 h-3 rounded-full ${entry.color} ring-2 ring-white shadow`} />
                <div className="bg-slate-50 border rounded-lg p-3 hover:shadow-sm transition">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-700 uppercase">{entry.label}</span>
                      <span className="text-xs text-slate-400">•</span>
                      <span className="text-xs font-medium text-slate-600">{entry.agent}</span>
                      <span className="text-xs text-slate-400 capitalize">({entry.role})</span>
                    </div>
                    <span className="text-xs text-slate-400">
                      {new Date(entry.date).toLocaleDateString()}{" "}
                      {new Date(entry.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 mt-1">{entry.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
