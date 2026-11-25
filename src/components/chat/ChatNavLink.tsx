"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessagesSquare } from "lucide-react";
import { getUnread } from "@/client/api/chat";

/** Sidebar entry for the team chat, with a live unread count. */
export default function ChatNavLink({ label }: { label: string }) {
  const [unread, setUnread] = useState(0);
  const pathname = usePathname();

  useEffect(() => {
    let alive = true;
    const load = () => {
      if (document.hidden) return;
      getUnread()
        .then((r) => alive && setUnread(r.unread))
        .catch(() => undefined);
    };
    load();
    const handle = setInterval(load, 20000);
    return () => {
      alive = false;
      clearInterval(handle);
    };
  }, [pathname]);

  const active = pathname?.startsWith("/dashboard/chat");
  return (
    <Link
      href="/dashboard/chat"
      className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
        active ? "bg-emerald-500/15 text-white ring-1 ring-emerald-500/30" : "hover:bg-slate-800 hover:text-white"
      }`}
    >
      <MessagesSquare className="me-3 h-5 w-5 text-emerald-400" />
      <span className="flex-1 truncate">{label}</span>
      {unread > 0 && (
        <span className="ms-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 px-1.5 text-[10px] font-bold text-white">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
