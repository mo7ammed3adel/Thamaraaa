"use client";

import { useEffect, useRef, useState } from "react";
import type { Participant, Room, Track, VideoTrack } from "livekit-client";
import { Maximize2, Mic, MicOff, Minimize2, MonitorUp, MonitorX, PhoneOff, Radio, Video, VideoOff, Volume2 } from "lucide-react";
import { formatDuration } from "@/lib/chat/media";
import { notify } from "@/components/toast";
import { Avatar } from "../ChatBits";
import { useChatT } from "../useChatT";
import type { CurrentCall } from "./CallProvider";

// String values of livekit's enums, so this file doesn't pull the SDK into
// the dashboard bundle (it's loaded only when a call starts).
const SOURCE = { camera: "camera", mic: "microphone", screen: "screen_share" } as const;
const ROOM_EVENTS = [
  "participantConnected",
  "participantDisconnected",
  "trackPublished",
  "trackUnpublished",
  "trackSubscribed",
  "trackUnsubscribed",
  "trackMuted",
  "trackUnmuted",
  "localTrackPublished",
  "localTrackUnpublished",
  "activeSpeakersChanged",
  "participantAttributesChanged",
  "connectionStateChanged",
] as const;

/** Re-renders whenever anything about the room changes. */
function useRoomTick(room: Room | null) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!room) return;
    const bump = () => setTick((n) => n + 1);
    // The emitter is typed per event; every one of these just triggers a render.
    const emitter = room as unknown as { on: (e: string, f: () => void) => void; off: (e: string, f: () => void) => void };
    ROOM_EVENTS.forEach((e) => emitter.on(e, bump));
    return () => {
      ROOM_EVENTS.forEach((e) => emitter.off(e, bump));
    };
  }, [room]);
}

function useClock(since: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const handle = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(handle);
  }, []);
  return since ? now - since : 0;
}

function videoTrackOf(p: Participant, source: string): VideoTrack | null {
  const pub = p.getTrackPublication(source as Track.Source);
  if (!pub || pub.isMuted || !pub.track) return null;
  return pub.track as VideoTrack;
}

function VideoView({ track, mirror, fit = "cover" }: { track: VideoTrack; mirror?: boolean; fit?: "cover" | "contain" }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    track.attach(el);
    return () => {
      track.detach(el);
    };
  }, [track]);
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted
      className={`h-full w-full bg-black ${fit === "cover" ? "object-cover" : "object-contain"} ${mirror ? "-scale-x-100" : ""}`}
    />
  );
}

function Tile({ p, isLocal, compact }: { p: Participant; isLocal: boolean; compact?: boolean }) {
  const { t } = useChatT();
  const cam = videoTrackOf(p, SOURCE.camera);
  const name = p.name || p.identity;
  const recording = p.attributes?.recording === "1";
  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden rounded-xl bg-slate-800 transition ${
        p.isSpeaking ? "ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-950" : "ring-1 ring-white/10"
      } ${compact ? "aspect-video w-full" : "aspect-video min-h-0 w-full"}`}
      data-testid="call-tile"
    >
      {cam ? (
        <VideoView track={cam} mirror={isLocal} />
      ) : (
        <div className="flex flex-col items-center gap-2">
          <span className={`rounded-2xl ${p.isSpeaking ? "ring-4 ring-emerald-400/60" : ""}`}>
            <Avatar name={name} seed={p.identity} size={compact ? 36 : 72} />
          </span>
        </div>
      )}
      <div className="absolute bottom-1.5 start-1.5 flex max-w-[90%] items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-medium text-white">
        {!p.isMicrophoneEnabled && <MicOff className="h-3 w-3 text-rose-400" />}
        <span className="truncate">
          {name} {isLocal ? t("you2") : ""}
        </span>
      </div>
      {recording && (
        <span className="absolute end-1.5 top-1.5 flex items-center gap-1 rounded-md bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
          <Radio className="h-3 w-3" /> {t("recordingOn")}
        </span>
      )}
    </div>
  );
}

function ControlButton({
  onClick,
  active = true,
  danger,
  title,
  children,
  testId,
}: {
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  title: string;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      data-testid={testId}
      className={`flex h-11 w-11 items-center justify-center rounded-full transition ${
        danger ? "bg-rose-600 text-white hover:bg-rose-500" : active ? "bg-white/10 text-white hover:bg-white/20" : "bg-white text-slate-900 hover:bg-slate-200"
      }`}
    >
      {children}
    </button>
  );
}

export function CallWindow({
  call,
  onLeave,
  onToggleRecording,
  onEnableAudio,
}: {
  call: CurrentCall;
  onLeave: () => void;
  onToggleRecording: () => void;
  onEnableAudio: () => void;
}) {
  const { t } = useChatT();
  const room = call.room;
  useRoomTick(room);
  const [minimized, setMinimized] = useState(false);
  const elapsed = useClock(call.connectedAt);

  const local = room?.localParticipant ?? null;
  const participants: Participant[] = room ? [room.localParticipant, ...Array.from(room.remoteParticipants.values())] : [];
  const sharer = participants.find((p) => videoTrackOf(p, SOURCE.screen));
  const screen = sharer ? videoTrackOf(sharer, SOURCE.screen) : null;
  const recordingBy = participants.filter((p) => p.attributes?.recording === "1").map((p) => p.name || p.identity);
  const someoneRecording = recordingBy.length > 0;

  // Tell people once when someone else starts recording them.
  const toldAboutRecording = useRef(false);
  useEffect(() => {
    if (someoneRecording && !call.recording && !toldAboutRecording.current) {
      toldAboutRecording.current = true;
      notify(`${t("recordingNotice")} — ${recordingBy.join("، ")}`, "info");
    }
    if (!someoneRecording) toldAboutRecording.current = false;
  }, [someoneRecording, call.recording, recordingBy, t]);

  const status =
    call.phase === "connecting" ? t("connecting") : call.phase === "ringing" ? t("ringing") : call.phase === "reconnecting" ? t("reconnecting") : formatDuration(elapsed);

  async function toggle(kind: "mic" | "camera" | "screen") {
    if (!local) return;
    try {
      if (kind === "mic") await local.setMicrophoneEnabled(!local.isMicrophoneEnabled);
      else if (kind === "camera") await local.setCameraEnabled(!local.isCameraEnabled);
      else await local.setScreenShareEnabled(!local.isScreenShareEnabled, { audio: true, selfBrowserSurface: "exclude" });
    } catch (e) {
      const name = e instanceof DOMException ? e.name : e instanceof Error ? e.name : "";
      // Cancelling the screen picker is not an error worth a toast.
      if (kind === "screen" && name === "NotAllowedError") return;
      notify(kind === "mic" ? t("micDenied") : kind === "camera" ? t("cameraDenied") : t("callFailed"), "error");
    }
  }

  const controls = (
    <div className="flex items-center justify-center gap-2">
      <ControlButton testId="call-mic" title={local?.isMicrophoneEnabled ? t("mute") : t("unmute")} active={local?.isMicrophoneEnabled ?? true} onClick={() => toggle("mic")}>
        {local?.isMicrophoneEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
      </ControlButton>
      <ControlButton testId="call-camera" title={local?.isCameraEnabled ? t("cameraOff") : t("cameraOn")} active={!(local?.isCameraEnabled ?? false)} onClick={() => toggle("camera")}>
        {local?.isCameraEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
      </ControlButton>
      {!minimized && (
        <ControlButton testId="call-screen" title={local?.isScreenShareEnabled ? t("stopShare") : t("shareScreen")} active={!(local?.isScreenShareEnabled ?? false)} onClick={() => toggle("screen")}>
          {local?.isScreenShareEnabled ? <MonitorX className="h-5 w-5" /> : <MonitorUp className="h-5 w-5" />}
        </ControlButton>
      )}
      <ControlButton testId="call-record" title={call.recording ? t("stopRecording") : t("startRecording")} active={!call.recording} onClick={onToggleRecording}>
        <Radio className={`h-5 w-5 ${call.recording ? "text-rose-600" : ""}`} />
      </ControlButton>
      <ControlButton testId="call-leave" title={t("leaveCall")} danger onClick={onLeave}>
        <PhoneOff className="h-5 w-5" />
      </ControlButton>
    </div>
  );

  const header = (
    <div className="flex items-center gap-2 px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-white">{call.conversationName}</p>
        <p className="flex items-center gap-1.5 text-xs text-slate-400">
          <span className={`h-1.5 w-1.5 rounded-full ${call.phase === "live" ? "bg-emerald-400" : "animate-pulse bg-amber-400"}`} />
          <span className="tabular-nums" data-testid="call-status">{status}</span>
          {participants.length > 1 && <span>· {participants.length} {t("participants")}</span>}
        </p>
      </div>
      {someoneRecording && (
        <span className="flex items-center gap-1 rounded-full bg-rose-600 px-2 py-0.5 text-[11px] font-bold text-white" data-testid="call-recording-badge">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> {t("recordingOn")}
        </span>
      )}
      <button type="button" onClick={() => setMinimized((m) => !m)} className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10" title={minimized ? t("expand") : t("minimize")}>
        {minimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
      </button>
    </div>
  );

  const audioPrompt = call.audioBlocked && (
    <button type="button" onClick={onEnableAudio} className="mx-3 mb-2 flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400">
      <Volume2 className="h-4 w-4" /> {t("enableAudio")}
    </button>
  );

  if (minimized) {
    return (
      <div className="fixed bottom-4 end-4 z-[60] w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-white/10 bg-slate-950/95 shadow-2xl shadow-black/50 backdrop-blur" data-testid="call-window">
        {header}
        {audioPrompt}
        <div className="flex gap-1.5 overflow-x-auto px-3 pb-2">
          {participants.slice(0, 4).map((p) => (
            <div key={p.identity} className="w-16 shrink-0">
              <Tile p={p} isLocal={p === local} compact />
            </div>
          ))}
        </div>
        <div className="border-t border-white/10 py-2.5">{controls}</div>
      </div>
    );
  }

  const cols = participants.length <= 1 ? "grid-cols-1" : participants.length <= 4 ? "grid-cols-2" : participants.length <= 9 ? "grid-cols-3" : "grid-cols-4";
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-slate-950 sm:inset-6 sm:rounded-3xl sm:border sm:border-white/10 sm:shadow-2xl sm:shadow-black/60" data-testid="call-window">
      {header}
      {audioPrompt}
      <div className="flex min-h-0 flex-1 gap-3 p-3">
        {screen && sharer ? (
          <>
            <div className="relative min-w-0 flex-1 overflow-hidden rounded-xl ring-1 ring-white/10">
              <VideoView track={screen} fit="contain" />
              <span className="absolute start-2 top-2 rounded-md bg-black/60 px-2 py-0.5 text-xs text-white">
                {sharer.name || sharer.identity} · {t("screen")}
              </span>
            </div>
            <div className="hidden w-48 shrink-0 flex-col gap-2 overflow-y-auto md:flex">
              {participants.map((p) => (
                <Tile key={p.identity} p={p} isLocal={p === local} compact />
              ))}
            </div>
          </>
        ) : (
          <div className={`grid min-h-0 flex-1 content-center gap-3 ${cols}`}>
            {participants.map((p) => (
              <Tile key={p.identity} p={p} isLocal={p === local} />
            ))}
          </div>
        )}
      </div>
      <div className="border-t border-white/10 py-4">{controls}</div>
    </div>
  );
}
