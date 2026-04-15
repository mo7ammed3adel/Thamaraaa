"use client";

import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NotificationBell({ variant = "dropdown" }: { variant?: "dropdown" | "sidebar" }) {
  const pathname = usePathname();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  // Poll for notifications every 30 seconds (skip when tab is hidden)
  useEffect(() => {
    const fetchNotifications = async () => {
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const res = await fetch("/api/notifications");
        if (res.ok) {
          const { data } = await res.json();
          setNotifications(data || []);
        }
      } catch (err) {
        console.error("Failed to fetch notifications");
      }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);

    // Re-fetch immediately when tab becomes visible again
    const handleVisibility = () => {
      if (!document.hidden) fetchNotifications();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  const markAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/notifications/${id}`, { method: "PATCH" });
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (err) {
      console.error(err);
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
        <div className="relative mr-3">
          <Bell className="h-5 w-5 opacity-75" />
          {notifications.length > 0 && (
            <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white ring-2 ring-slate-900 border-none">
              {notifications.length > 9 ? "9+" : notifications.length}
            </span>
          )}
        </div>
        <span className="truncate">Notifications</span>
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
            <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
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
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{notif.title}</p>
                      <p className="text-sm text-gray-500 line-clamp-2 mt-0.5">{notif.message}</p>
                      <p className="text-xs text-gray-400 mt-2">
                        {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
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
