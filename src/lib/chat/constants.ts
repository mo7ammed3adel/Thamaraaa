/**
 * Team chat — values shared by the server (validation) and the client (UI).
 * Nothing here touches Node or the database, so it is safe to import anywhere.
 */

export const CHAT_TYPES = ["dm", "group", "channel"] as const;
export type ChatType = (typeof CHAT_TYPES)[number];

export const MAX_MESSAGE_LENGTH = 4000;
export const MAX_NAME_LENGTH = 80;
export const MAX_DESCRIPTION_LENGTH = 500;
export const MAX_GROUP_MEMBERS = 200;

export const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB per file
export const MAX_FILES_PER_MESSAGE = 10;
/** Whole multipart request; the server buffers it, so this bounds memory per upload. */
export const MAX_UPLOAD_TOTAL_BYTES = 100 * 1024 * 1024;

export const MESSAGES_PAGE_SIZE = 50;

/** Quick reactions offered on every message. Any other emoji is rejected. */
export const REACTION_EMOJIS = ["👍", "❤️", "😂", "🔥", "🎉", "👀", "🙏", "✅"] as const;

export function isAllowedReaction(emoji: unknown): emoji is string {
  return typeof emoji === "string" && (REACTION_EMOJIS as readonly string[]).includes(emoji);
}

/**
 * Roles that may create channels. Anyone can open a DM or start a group, but a
 * channel is a company-wide space, so it is reserved for people who run a team.
 */
export function canCreateChannel(role: string | null | undefined): boolean {
  if (!role) return false;
  if (role === "super_admin" || role === "hr_manager") return true;
  return /(^|_)(manager|head|chief|leader)(_|$)/.test(role) || role.startsWith("team_leader");
}

// ── Stickers ────────────────────────────────────────────────────────────────

export type StickerDef = {
  id: string;
  emoji: string;
  caption: { ar: string; en: string };
  /** Tailwind gradient classes for the card background. */
  gradient: string;
  premium?: boolean;
};

export const STICKERS: StickerDef[] = [
  {
    id: "bondok-number-one",
    emoji: "😂",
    caption: { ar: "بندق نمبر ون", en: "Bondok Number One" },
    gradient: "from-amber-300 via-yellow-500 to-amber-700",
    premium: true,
  },
  { id: "haha", emoji: "🤣", caption: { ar: "هههههه", en: "Hahaha" }, gradient: "from-yellow-300 to-orange-400" },
  { id: "great", emoji: "🔥", caption: { ar: "عاش يا وحش", en: "Beast mode" }, gradient: "from-orange-400 to-rose-500" },
  { id: "ok", emoji: "👍", caption: { ar: "تمام", en: "Done deal" }, gradient: "from-emerald-400 to-teal-500" },
  { id: "morning", emoji: "☀️", caption: { ar: "صباح الفل", en: "Good morning" }, gradient: "from-sky-300 to-amber-300" },
  { id: "go", emoji: "🚀", caption: { ar: "يلا بينا", en: "Let's go" }, gradient: "from-indigo-400 to-fuchsia-500" },
  { id: "thanks", emoji: "🙏", caption: { ar: "تسلم إيدك", en: "Thank you" }, gradient: "from-teal-300 to-cyan-500" },
  { id: "wait", emoji: "⏳", caption: { ar: "ثواني وجاي", en: "One sec" }, gradient: "from-slate-300 to-slate-500" },
  { id: "done", emoji: "✅", caption: { ar: "خلصت", en: "Finished" }, gradient: "from-green-400 to-emerald-600" },
  { id: "love", emoji: "❤️", caption: { ar: "حبيبي والله", en: "Love it" }, gradient: "from-pink-400 to-rose-600" },
  { id: "think", emoji: "🤔", caption: { ar: "خليني أفكر", en: "Let me think" }, gradient: "from-violet-300 to-purple-500" },
  { id: "coffee", emoji: "☕", caption: { ar: "بريك قهوة", en: "Coffee break" }, gradient: "from-amber-600 to-stone-700" },
];

export function findSticker(id: unknown): StickerDef | undefined {
  return typeof id === "string" ? STICKERS.find((s) => s.id === id) : undefined;
}

// ── Display helpers ─────────────────────────────────────────────────────────

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Order-independent key for the one DM a pair of employees shares. */
export function buildDmKey(a: string, b: string): string {
  return [a, b].sort().join(":");
}
