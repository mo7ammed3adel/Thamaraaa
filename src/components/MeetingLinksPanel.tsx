"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, Video } from "lucide-react";
import {
  listMeetingLinkNotifications,
  markNotificationRead,
  type NotificationItem,
} from "@/client/api/notifications";

import { useTranslator } from "@/components/i18n/LocaleProvider";
export default function MeetingLinksPanel() {
  const t = useTranslator();
  const [links, setLinks] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLinks = async () => {
    try {
      const { data } = await listMeetingLinkNotifications();
      setLinks(data || []);
    } catch (error) {
      console.error("Failed to fetch meeting links");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLinks();
  }, []);

  const handleMarkRead = async (notificationId: string) => {
    await markNotificationRead(notificationId);
    setLinks((current) =>
      current.map((link) => link.id === notificationId ? { ...link, read: true } : link)
    );
  };

  return (
    <section className="bg-white rounded-xl shadow-sm border border-blue-200 overflow-hidden">
      <div className="px-5 py-4 bg-blue-50 border-b border-blue-100 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
            <Video className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-blue-950">{t("meetLink.title")}</h2>
            <p className="text-xs text-blue-700">{t("meetLink.subtitle")}</p>
          </div>
        </div>
        {links.some((link) => !link.read) && (
          <span className="px-2.5 py-1 rounded-full bg-blue-600 text-white text-xs font-bold">
            {links.filter((link) => !link.read).length} new
          </span>
        )}
      </div>

      {loading ? (
        <div className="px-5 py-4 text-sm text-slate-500">{t("meetLink.loading")}</div>
      ) : links.length === 0 ? (
        <div className="px-5 py-4 text-sm text-slate-500">{t("meetLink.none")}</div>
      ) : (
        <div className="divide-y divide-slate-100">
          {links.map((item) => (
            <div key={item.id} className="px-5 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-semibold text-slate-900 truncate">{item.title}</p>
                  {!item.read && <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">NEW</span>}
                </div>
                <p className="text-sm text-slate-600 line-clamp-2">{item.message}</p>
                <p className="text-xs text-slate-400 mt-1">{new Date(item.createdAt).toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {item.link && (
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Open Link
                  </a>
                )}
                {!item.read && (
                  <button
                    onClick={() => handleMarkRead(item.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-200 transition"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Mark Read
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
