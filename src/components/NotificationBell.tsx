"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import type { NotificationItem } from "@/client/api/notifications";
import { useTranslator } from "@/components/i18n/LocaleProvider";
import { markNotificationAsRead, useUnreadNotifications } from "@/components/notificationFeed";

function formatWhen(createdAt: string) {
  const date = new Date(createdAt);
  const sameDay = date.toDateString() === new Date().toDateString();
  return sameDay
    ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function NotificationBell({ variant = "dropdown" }: { variant?: "dropdown" | "sidebar" }) {
  const t = useTranslator();
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  // Shared feed: both bells (header + sidebar) read the same list and poller.
  const notifications = useUnreadNotifications((session?.user as { id?: string } | undefined)?.id);
  const [showDropdown, setShowDropdown] = useState(false);

  const markAsRead = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    void markNotificationAsRead(id);
  };

  // Clicking a notification marks it read and takes the user to its link.
  const openNotification = (notif: NotificationItem) => {
    void markNotificationAsRead(notif.id);
    if (!notif.link) return;
    setShowDropdown(false);
    if (notif.link.startsWith("/")) {
      router.push(notif.link);
    } else {
      window.open(notif.link, "_blank", "noopener,noreferrer");
    }
  };

  if (variant === "sidebar") {
    return (
      <Link
        href="/dashboard/notifications"
        className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
          pathname === "/dashboard/notifications" ? "bg-slate-800 text-white" : "hover:bg-slate-800 hover:text-white"
        }`}
      >
        <div className="relative me-3">
          <Bell className="h-5 w-5 opacity-75" />
          {notifications.length > 0 && (
            <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white ring-2 ring-slate-900 border-none">
              {notifications.length > 9 ? "9+" : notifications.length}
            </span>
          )}
        </div>
        <span className="truncate">{t("common.notifications")}</span>
      </Link>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="p-2 text-gray-400 hover:text-gray-500 rounded-full hover:bg-gray-100 transition relative"
      >
        <Bell className="h-6 w-6" />
        {notifications.length > 0 && (
          <span className="absolute top-1 right-1 block h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
        )}
      </button>

      {showDropdown && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-50">
          <div className="bg-slate-50 px-4 py-3 border-b flex justify-between items-center">
            <h3 className="text-sm font-semibold text-gray-900">{t("common.notifications")}</h3>
            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-medium">
              {notifications.length} New
            </span>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-sm text-gray-500">
                No new notifications
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {notifications.map((notif) => (
                  <li key={notif.id} className="p-4 hover:bg-gray-50 flex gap-3 transition">
                    <div
                      className={`flex-1 min-w-0 ${notif.link ? "cursor-pointer" : ""}`}
                      onClick={() => notif.link && openNotification(notif)}
                    >
                      <p className="text-sm font-medium text-gray-900">{notif.title}</p>
                      <p className="text-sm text-gray-500 line-clamp-2 mt-0.5">{notif.message}</p>
                      {notif.link && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openNotification(notif);
                          }}
                          className="mt-2 inline-flex text-xs font-semibold text-blue-600 hover:text-blue-800 underline"
                        >
                          Open Link
                        </button>
                      )}
                      <p className="text-xs text-gray-400 mt-2">{formatWhen(notif.createdAt)}</p>
                    </div>
                    <div>
                      <button
                        onClick={(e) => markAsRead(notif.id, e)}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Mark Read
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="p-3 bg-gray-50 border-t text-center">
              <Link href="/dashboard/notifications" onClick={() => setShowDropdown(false)} className="text-xs font-semibold text-blue-600 hover:text-blue-800">
                View All History
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
