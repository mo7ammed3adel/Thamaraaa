"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Mic, Pause, Phone, PhoneIncoming, PhoneMissed, Play, Radio, Video } from "lucide-react";
import { attachmentUrl, type ChatAttachment, type ChatMessage } from "@/client/api/chat";
import { decodeWaveform, formatDuration, WAVEFORM_BARS } from "@/lib/chat/media";
import { useChatT } from "./useChatT";

/** Only one voice note plays at a time, like WhatsApp. */
const PLAY_EVENT = "thamaraa:chat-audio-play";
const SPEEDS = [1, 1.5, 2];

export function VoicePlayer({ attachment, kind }: { attachment: ChatAttachment; kind: "voice" | "recording" }) {
  const { t } = useChatT();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [mediaDuration, setMediaDuration] = useState<number | null>(null);

  // Recorded WebM has no duration header, so the recorder's own count wins.
  const duration = attachment.durationMs ? attachment.durationMs / 1000 : mediaDuration ?? 0;
  const bars = useMemo(() => {
    const decoded = decodeWaveform(attachment.waveform);
    return decoded.length ? decoded : Array.from({ length: WAVEFORM_BARS }, () => 0.25);
  }, [attachment.waveform]);
  const progress = duration > 0 ? Math.min(1, position / duration) : 0;

  useEffect(() => {
    const other = (e: Event) => {
      if ((e as CustomEvent).detail !== audioRef.current) audioRef.current?.pause();
    };
    window.addEventListener(PLAY_EVENT, other);
    return () => window.removeEventListener(PLAY_EVENT, other);
  }, []);

  function toggle() {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      window.dispatchEvent(new CustomEvent(PLAY_EVENT, { detail: el }));
      el.playbackRate = speed;
      el.play().catch(() => undefined);
    } else el.pause();
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const el = audioRef.current;
    if (!el || duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
    const fraction = Math.min(1, Math.max(0, (rtl ? rect.right - e.clientX : e.clientX - rect.left) / rect.width));
    el.currentTime = fraction * duration;
    setPosition(el.currentTime);
  }

  const isRecording = kind === "recording";
  return (
    <div
      className={`flex w-80 max-w-full items-center gap-2.5 rounded-2xl border px-2.5 py-2 shadow-sm ${
        isRecording ? "border-rose-200 bg-gradient-to-r from-rose-50 to-white" : "border-emerald-200 bg-gradient-to-r from-emerald-50 to-white"
      }`}
      data-testid={`voice-${kind}`}
    >
      <audio
        ref={audioRef}
        src={attachmentUrl(attachment.id)}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setPosition(0);
        }}
        onTimeUpdate={(e) => setPosition(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => Number.isFinite(e.currentTarget.duration) && setMediaDuration(e.currentTarget.duration)}
      />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? t("pause") : t("play")}
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white shadow-md transition hover:scale-105 ${
          isRecording ? "bg-rose-500 hover:bg-rose-600" : "bg-emerald-600 hover:bg-emerald-700"
        }`}
      >
        {playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 translate-x-[1px] fill-current rtl:-translate-x-[1px] rtl:rotate-180" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex h-8 cursor-pointer items-center gap-[2px] overflow-hidden" onClick={seek} role="slider" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
          {bars.map((level, i) => (
            <span
              key={i}
              className={`w-[3px] min-w-px rounded-full transition-colors ${
                i / bars.length < progress ? (isRecording ? "bg-rose-500" : "bg-emerald-600") : "bg-slate-300"
              }`}
              style={{ height: `${Math.max(12, level * 100)}%` }}
            />
          ))}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500">
          {isRecording ? <Radio className="h-3 w-3 text-rose-500" /> : <Mic className="h-3 w-3 text-emerald-600" />}
          <span className="font-medium">{isRecording ? t("callRecording") : t("voiceMessage")}</span>
          <span className="tabular-nums">{formatDuration((playing || position > 0 ? position : duration) * 1000)}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={() => {
          const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
          setSpeed(next);
          if (audioRef.current) audioRef.current.playbackRate = next;
        }}
        className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
      >
        {speed}×
      </button>
      {isRecording && (
        <a href={attachmentUrl(attachment.id, true)} className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="download">
          <Download className="h-4 w-4" />
        </a>
      )}
    </div>
  );
}

export function CallCard({
  message,
  meId,
  activeCallId,
  activeCount,
  onJoin,
}: {
  message: ChatMessage;
  meId: string;
  activeCallId: string | null;
  activeCount: number;
  onJoin: (video: boolean) => void;
}) {
  const { t } = useChatT();
  const call = message.call;
  if (!call) return null;
  const live = activeCallId === call.id;
  const mine = message.sender?.id === meId;
  const Icon = call.video ? Video : Phone;

  if (live) {
    return (
      <div className="mt-1 flex w-80 max-w-full items-center gap-3 rounded-2xl border border-emerald-300 bg-gradient-to-r from-emerald-50 via-white to-emerald-50 p-3 shadow-sm" data-testid="call-card-live">
        <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
          <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-40" />
          <Icon className="relative h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-900">{call.video ? t("videoCallOngoing") : t("callOngoing")}</p>
          <p className="text-xs text-slate-500">
            {activeCount} {t("inCall")}
          </p>
        </div>
        <button type="button" onClick={() => onJoin(call.video)} className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-sm font-semibold text-white shadow hover:bg-emerald-700">
          {t("joinCall")}
        </button>
      </div>
    );
  }

  const duration = call.endedAt ? new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime() : 0;
  const missed = call.missed;
  const MissedIcon = mine ? Icon : PhoneMissed;
  return (
    <div className={`mt-1 inline-flex items-center gap-2.5 rounded-xl border px-3 py-2 ${missed ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-slate-50"}`} data-testid="call-card">
      <span className={`flex h-8 w-8 items-center justify-center rounded-full ${missed ? "bg-rose-100 text-rose-600" : "bg-slate-200 text-slate-600"}`}>
        {missed ? <MissedIcon className="h-4 w-4" /> : mine ? <Icon className="h-4 w-4" /> : <PhoneIncoming className="h-4 w-4" />}
      </span>
      <div>
        <p className={`text-sm font-semibold ${missed ? "text-rose-700" : "text-slate-800"}`}>
          {missed ? (mine ? t("noAnswer") : t("missedCall")) : call.video ? t("videoCall") : t("audioCall")}
        </p>
        <p className="text-xs text-slate-500">
          {missed ? (call.video ? t("videoCall") : t("audioCall")) : `${t("callEnded")}${duration > 0 ? ` · ${formatDuration(duration)}` : ""}`}
        </p>
      </div>
    </div>
  );
}
