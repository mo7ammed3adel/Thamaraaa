"use client";

import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NotificationBell() {
  const pathname = usePathname();
  const [notifications, setNotifications] = useState<any[]>([]);

  // Poll for notifications every 30 seconds
  useEffect(() => {
    const fetchNotifications = async () => {
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
    return () => clearInterval(interval);
  }, []);



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
