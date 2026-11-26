"use client";

import { Crown, Hash, Lock, Users } from "lucide-react";
import { findSticker } from "@/lib/chat/constants";
import type { ChatType } from "@/client/api/chat";

const AVATAR_GRADIENTS = [
  "from-emerald-400 to-teal-600",
  "from-sky-400 to-indigo-600",
  "from-amber-400 to-orange-600",
  "from-rose-400 to-pink-600",
  "from-violet-400 to-purple-600",
  "from-cyan-400 to-blue-600",
  "from-lime-400 to-green-600",
  "from-fuchsia-400 to-rose-600",
];

function hash(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function initials(name: string | null | undefined): string {
  const parts = (name || "?").trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "?";
}

export function Avatar({
  name,
  seed,
  size = 36,
  online,
}: {
  name: string | null | undefined;
  seed?: string;
  size?: number;
  online?: boolean;
}) {
  const gradient = AVATAR_GRADIENTS[hash(seed || name || "?") % AVATAR_GRADIENTS.length];
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div
        className={`flex h-full w-full items-center justify-center rounded-xl bg-gradient-to-br ${gradient} font-semibold text-white shadow-sm ring-1 ring-white/20`}
        style={{ fontSize: size * 0.38 }}
      >
        {initials(name)}
      </div>
      {online !== undefined && (
        <span
          className={`absolute -bottom-0.5 -end-0.5 h-3 w-3 rounded-full ring-2 ring-white ${online ? "bg-emerald-400" : "bg-slate-500"}`}
        />
      )}
    </div>
  );
}

export function ConversationIcon({ type, isPrivate, className = "h-4 w-4" }: { type: ChatType; isPrivate: boolean; className?: string }) {
  if (type === "channel") return isPrivate ? <Lock className={className} /> : <Hash className={className} />;
  return <Users className={className} />;
}

/** The premium "Bondok Number One" sticker — gold, crowned, laughing. */
function BondokSticker({ size }: { size: number }) {
  return (
    <div className="relative select-none" style={{ width: size, height: size }}>
      <style>{`
        @keyframes chat-shine { 0% { transform: translateX(-120%) rotate(20deg); } 60%, 100% { transform: translateX(220%) rotate(20deg); } }
        @keyframes chat-bob { 0%, 100% { transform: translateY(0) rotate(-6deg); } 50% { transform: translateY(-4px) rotate(6deg); } }
      `}</style>
      <div className="absolute inset-0 overflow-hidden rounded-[28%] bg-gradient-to-br from-amber-200 via-yellow-500 to-amber-700 shadow-[0_10px_30px_-8px_rgba(217,119,6,0.75)] ring-2 ring-amber-200/80">
        <div className="absolute inset-[5%] rounded-[24%] bg-gradient-to-b from-slate-900 via-slate-900 to-black ring-1 ring-amber-300/60" />
        <div
          className="absolute -inset-y-4 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent"
          style={{ animation: "chat-shine 3.2s ease-in-out infinite" }}
        />
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <Crown className="text-amber-300 drop-shadow" style={{ width: size * 0.2, height: size * 0.2 }} fill="currentColor" />
        <span
          className="bg-gradient-to-b from-amber-100 via-amber-300 to-amber-600 bg-clip-text font-black leading-none text-transparent"
          style={{ fontSize: size * 0.24 }}
        >
          بندق
        </span>
        <span className="mt-0.5 font-extrabold tracking-wide text-amber-200" style={{ fontSize: size * 0.11 }}>
          نمبر ون
        </span>
        <span
          className="mt-1 rounded-full bg-gradient-to-r from-amber-400 to-yellow-300 px-2 font-black text-slate-900"
          style={{ fontSize: size * 0.09 }}
        >
          #1
        </span>
      </div>
      <span
        className="absolute -bottom-[12%] -end-[12%] drop-shadow-lg"
        style={{ fontSize: size * 0.3, animation: "chat-bob 1.6s ease-in-out infinite" }}
      >
        😂
      </span>
      <span
        className="absolute -top-[7%] start-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 px-2 py-px font-bold uppercase tracking-widest text-slate-900 shadow"
        style={{ fontSize: Math.max(8, size * 0.065) }}
      >
        Premium
      </span>
    </div>
  );
}

export function Sticker({ id, locale, size = 132 }: { id: string; locale: "ar" | "en"; size?: number }) {
  const sticker = findSticker(id);
  if (!sticker) return null;
  if (sticker.id === "bondok-number-one") return <BondokSticker size={size} />;
  return (
    <div
      className={`flex select-none flex-col items-center justify-center rounded-[28%] bg-gradient-to-br ${sticker.gradient} text-center shadow-lg ring-1 ring-white/30`}
      style={{ width: size, height: size }}
    >
      <span style={{ fontSize: size * 0.42 }} className="leading-none drop-shadow">
        {sticker.emoji}
      </span>
      <span className="mt-2 px-2 font-extrabold text-white drop-shadow" style={{ fontSize: size * 0.12 }}>
        {sticker.caption[locale]}
      </span>
    </div>
  );
}
