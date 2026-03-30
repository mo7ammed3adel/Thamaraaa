"use client";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export default function LogoutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="flex items-center w-full px-3 py-2 text-sm font-medium text-red-400 bg-slate-800/50 rounded-md hover:bg-slate-800 hover:text-red-300 transition-colors"
    >
      <LogOut className="mr-3 h-5 w-5" />
      Sign out
    </button>
  );
}
