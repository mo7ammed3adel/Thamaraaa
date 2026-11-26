/**
 * Voice notes, call recordings and calls — values and pure helpers shared by
 * the server (validation) and the browser (recording, display). No Node or
 * database imports, so it is safe anywhere.
 */

export const MEDIA_MESSAGE_KINDS = ["voice", "recording"] as const;
export type MediaMessageKind = (typeof MEDIA_MESSAGE_KINDS)[number];

export function isMediaMessageKind(value: unknown): value is MediaMessageKind {
  return typeof value === "string" && (MEDIA_MESSAGE_KINDS as readonly string[]).includes(value);
}

/** A voice note is a quick message, not a podcast. */
export const MAX_VOICE_MS = 5 * 60 * 1000;
/**
 * A call recording at ~24 kbps Opus is ~11 MB an hour, so three hours stays
 * well inside the 50 MB per-file limit.
 */
export const MAX_RECORDING_MS = 3 * 60 * 60 * 1000;
export const RECORDING_BITRATE = 24_000;
export const VOICE_BITRATE = 32_000;

/** Containers MediaRecorder produces (Chrome/Firefox: WebM/Ogg, Safari: MP4). */
const MEDIA_MIME_TYPES = new Set(["video/webm", "audio/webm", "audio/ogg", "audio/mp4", "video/mp4", "audio/mpeg", "audio/wav"]);

export function isRecordedAudioMime(mime: string): boolean {
  return MEDIA_MIME_TYPES.has(mime);
}

// ── Waveform ────────────────────────────────────────────────────────────────
// Stored as one base-32 digit per bar (0 = silent … v = loudest), so a whole
// waveform is a short, inert string the server can validate with a regex.

export const WAVEFORM_BARS = 48;
const DIGITS = "0123456789abcdefghijklmnopqrstuv";
const WAVEFORM_PATTERN = /^[0-9a-v]{1,64}$/;

/** Downsamples peak levels (0..1) to WAVEFORM_BARS bars and encodes them. */
export function encodeWaveform(levels: number[], bars = WAVEFORM_BARS): string {
  if (levels.length === 0) return "";
  const out: string[] = [];
  for (let i = 0; i < bars; i++) {
    const from = Math.floor((i * levels.length) / bars);
    const to = Math.max(from + 1, Math.floor(((i + 1) * levels.length) / bars));
    let peak = 0;
    for (let j = from; j < to && j < levels.length; j++) peak = Math.max(peak, levels[j]);
    const clamped = Math.min(1, Math.max(0, Number.isFinite(peak) ? peak : 0));
    out.push(DIGITS[Math.round(clamped * 31)]);
  }
  return out.join("");
}

export function decodeWaveform(value: string | null | undefined): number[] {
  if (!value || !WAVEFORM_PATTERN.test(value)) return [];
  return Array.from(value, (c) => DIGITS.indexOf(c) / 31);
}

export function cleanWaveform(value: unknown): string | null {
  return typeof value === "string" && WAVEFORM_PATTERN.test(value) ? value : null;
}

/** Client-reported length, clamped to the kind's limit. Display only. */
export function cleanDurationMs(value: unknown, kind: MediaMessageKind): number | null {
  const n = typeof value === "string" ? Number(value) : typeof value === "number" ? value : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(Math.round(n), kind === "voice" ? MAX_VOICE_MS : MAX_RECORDING_MS);
}

export function formatDuration(ms: number | null | undefined): string {
  const total = Math.max(0, Math.round((ms ?? 0) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

// ── Links ───────────────────────────────────────────────────────────────────

const URL_IN_TEXT = /https?:\/\/[^\s<>"'`]+/g;

/** The http(s) links in a message, without trailing punctuation, de-duplicated. */
export function extractLinks(text: string | null | undefined): string[] {
  if (!text) return [];
  const found = new Set<string>();
  for (const raw of Array.from(text.matchAll(URL_IN_TEXT), (x) => x[0])) {
    let url = raw.replace(/[.,!?؟،:;*_~]+$/, "");
    // A closing bracket belongs to the sentence unless the link opened one.
    const opens = (u: string) => (u.match(/[([]/g) ?? []).length;
    const closes = (u: string) => (u.match(/[)\]]/g) ?? []).length;
    while (/[)\]]$/.test(url) && closes(url) > opens(url)) url = url.slice(0, -1);
    if (url.length > 10) found.add(url);
  }
  return Array.from(found);
}

// ── Calls ───────────────────────────────────────────────────────────────────

export function callRoomName(callId: string): string {
  return `call-${callId}`;
}

const ROOM_PATTERN = /^call-([0-9a-f-]{36})$/;

export function callIdFromRoom(room: string | null | undefined): string | null {
  const match = room ? ROOM_PATTERN.exec(room) : null;
  return match ? match[1] : null;
}

/** Channels are big public spaces: a call there is joinable, never a ring. */
export function callRings(conversationType: string): boolean {
  return conversationType === "dm" || conversationType === "group";
}

/** A DM call nobody but the caller joined is a missed call. */
export function isMissedCall(call: { endedAt: Date | string | null; participantIds: string[] }, conversationType: string): boolean {
  return Boolean(call.endedAt) && conversationType === "dm" && new Set(call.participantIds).size < 2;
}

/** How long a ring lasts before the caller gives up. */
export const RING_TIMEOUT_MS = 40_000;
/**
 * A call row whose room is gone (or never formed) is only closed after this
 * grace period, so a caller still connecting isn't cut off.
 */
export const STALE_CALL_GRACE_MS = 60_000;
