"use client";

import { useState, useEffect } from "react";
import { Bell, CheckCircle2 } from "lucide-react";

interface Notification {
  id: string;
  title: string;
  message: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

export default function NotificationsClient() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      // Full history (read + unread), not just the unread ones the bell shows.
      const res = await fetch("/api/notifications?type=history");
      if (res.ok) {
        const { data } = await res.json();
        setNotifications(data || []);
      }
    } catch (err) {
      console.error("Failed to fetch notifications");
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/notifications/${id}`, { method: "PATCH" });
      // Keep it in the list as history — just flip it to read.
      setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)));
    } catch (err) {
      console.error(err);
    }
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter(n => !n.read);
    if (unread.length === 0) return;
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    await Promise.all(
      unread.map(n => fetch(`/api/notifications/${n.id}`, { method: "PATCH" }).catch(() => null))
    );
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading notifications...</div>;
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {notifications.length > 0 && (
        <div className="px-6 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <span className="text-sm text-gray-600">
            <span className="font-semibold text-gray-900">{notifications.length}</span> in history
            {unreadCount > 0 && <span className="ml-2 text-blue-600 font-semibold">· {unreadCount} unread</span>}
          </span>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-sm font-medium transition"
            >
              <CheckCircle2 className="h-4 w-4" />
              Mark all read
            </button>
          )}
        </div>
      )}
      {notifications.length === 0 ? (
        <div className="p-12 text-center flex flex-col items-center">
          <div className="bg-blue-50 text-blue-500 p-4 rounded-full mb-4">
            <Bell className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">No notifications yet</h3>
          <p className="text-gray-500 text-sm">When you receive a notification, it will appear here — read or unread.</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {notifications.map((notif) => (
            <li key={notif.id} className="p-6 hover:bg-gray-50 flex gap-4 transition items-start">
              <div className={`mt-1 p-2 rounded-full ${notif.read ? 'bg-gray-100 text-gray-400' : 'bg-blue-100 text-blue-600'}`}>
                <Bell className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-base font-semibold ${notif.read ? 'text-gray-600' : 'text-gray-900'}`}>{notif.title}</p>
                <p className="text-sm text-gray-600 mt-1">{notif.message}</p>
                <div className="flex items-center gap-4 mt-3">
                  <span className="text-xs text-gray-400 font-medium bg-gray-100 px-2 py-1 rounded">
                    {new Date(notif.createdAt).toLocaleString()}
                  </span>
                  {notif.link && (
                    <a
                      href={notif.link}
                      target={notif.link.startsWith("/") ? undefined : "_blank"}
                      rel={notif.link.startsWith("/") ? undefined : "noopener noreferrer"}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800 underline"
                    >
                      Open Link
                    </a>
                  )}
                </div>
              </div>
              {!notif.read && (
                <div>
                  <button 
                    onClick={(e) => markAsRead(notif.id, e)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg text-sm font-medium transition"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Mark Read
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
