"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Room, RemoteTrack, RemoteTrackPublication, LocalTrackPublication } from "livekit-client";
import {
  declineCall,
  getCallInfo,
  leaveCall,
  sendFileMessage,
  setCallRecording,
  startOrJoinCall,
  type CallInfo,
} from "@/client/api/chat";
import { notify } from "@/components/toast";
import { subscribe } from "@/lib/realtime/client";
import { MAX_RECORDING_MS, RECORDING_BITRATE, RING_TIMEOUT_MS, callRings } from "@/lib/chat/media";
import { MAX_FILE_BYTES } from "@/lib/chat/constants";
import { recordAudio, stampedName, type AudioRecording, type RecordingResult } from "@/lib/chat/recorder";
import { useChatT } from "../useChatT";
import { CallWindow } from "./CallWindow";
import { IncomingCall } from "./IncomingCall";
import { startTone, type Tone } from "./tones";

/**
 * Calls live here, above the dashboard pages, so a call keeps going while you
 * move around the app. One call at a time per tab.
 */

export type CallPhase = "connecting" | "ringing" | "live" | "reconnecting";

export type CurrentCall = {
  callId: string;
  conversationId: string;
  conversationName: string;
  conversationType: string;
  phase: CallPhase;
  room: Room | null;
  connectedAt: number | null;
  recording: boolean;
  audioBlocked: boolean;
};

type StartMeta = { name: string; type: string; callId?: string };

type CallsContextValue = {
  current: CurrentCall | null;
  /**
   * Start the conversation's call, or join the one already going. Pass the
   * call's id when answering or pressing Join, so a call that has just ended
   * is reported as ended instead of starting a new one.
   */
  start: (conversationId: string, video: boolean, meta: StartMeta) => Promise<void>;
};

const CallsContext = createContext<CallsContextValue>({ current: null, start: async () => undefined });

export function useCalls() {
  return useContext(CallsContext);
}

/** Sent on the window when this tab's call state changes, for the chat header. */
export const CALL_CHANGED_EVENT = "thamaraa:call-changed";

type CallSignal = { kind: "ring" | "state" | "declined"; conversationId: string; callId: string; userId?: string };

type Recorder = {
  rec: AudioRecording;
  context: AudioContext;
  destination: MediaStreamAudioDestinationNode;
  sources: Map<string, MediaStreamAudioSourceNode>;
  callId: string;
  conversationId: string;
};

/** A DM where the other person is gone for this long is over. */
const DM_ALONE_GRACE_MS = 8000;
/** Leave headroom under the per-file upload limit. */
const RECORDING_MAX_BYTES = MAX_FILE_BYTES - 3 * 1024 * 1024;

function saveToDevice(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export default function CallProvider({ meId, children }: { meId: string; children: React.ReactNode }) {
  const { t } = useChatT();
  const [current, setCurrent] = useState<CurrentCall | null>(null);
  const currentRef = useRef<CurrentCall | null>(null);
  currentRef.current = current;
  const [incoming, setIncoming] = useState<CallInfo | null>(null);
  const incomingRef = useRef<CallInfo | null>(null);
  incomingRef.current = incoming;
  const recorder = useRef<Recorder | null>(null);
  const audioHost = useRef<HTMLDivElement | null>(null);
  const leaving = useRef(false);
  /** Bumped by every start and hang-up, so a superseded start knows to back out. */
  const attempt = useRef(0);
  const ringTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aloneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tone = useRef<Tone | null>(null);
  /** Calls that changed state while their ring card was still loading. */
  const signaledWhileLoading = useRef(new Set<string>());

  const patch = useCallback((change: Partial<CurrentCall>) => {
    setCurrent((cur) => (cur ? { ...cur, ...change } : cur));
  }, []);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent(CALL_CHANGED_EVENT, { detail: current ? { conversationId: current.conversationId, callId: current.callId } : null }));
  }, [current?.callId, current?.conversationId]); // eslint-disable-line react-hooks/exhaustive-deps

  const stopTone = useCallback(() => {
    tone.current?.stop();
    tone.current = null;
  }, []);

  const clearTimers = useCallback(() => {
    if (ringTimer.current) clearTimeout(ringTimer.current);
    if (aloneTimer.current) clearTimeout(aloneTimer.current);
    ringTimer.current = null;
    aloneTimer.current = null;
  }, []);

  // ── Recording ─────────────────────────────────────────────────────────────

  /** Mixes one audio track into the recording (idempotent per track). */
  const addToMix = useCallback((key: string, track: MediaStreamTrack | undefined) => {
    const r = recorder.current;
    if (!r || !track || r.sources.has(key)) return;
    const source = r.context.createMediaStreamSource(new MediaStream([track]));
    source.connect(r.destination);
    r.sources.set(key, source);
  }, []);

  const removeFromMix = useCallback((key: string) => {
    const r = recorder.current;
    const source = r?.sources.get(key);
    if (!r || !source) return;
    source.disconnect();
    r.sources.delete(key);
  }, []);

  /**
   * Uploads a finished recording, retrying; if it still can't be sent (say the
   * network is gone), the file is saved to this device so it is never lost.
   */
  const deliverRecording = useCallback(
    async (result: RecordingResult, target: { callId: string; conversationId: string }, reason: "user" | "limit" | "leave") => {
      for (let tryNo = 0; tryNo < 4; tryNo++) {
        try {
          await sendFileMessage(target.conversationId, {
            files: [result.file],
            media: { kind: "recording", durationMs: result.durationMs, waveform: result.waveform, callId: target.callId },
          });
          notify(reason === "limit" ? t("recordingLimit") : t("recordingSaved"), "success");
          return;
        } catch (e) {
          const status = e && typeof e === "object" && "status" in e ? (e as { status: number }).status : 0;
          // A refusal (not a network blip) won't change on retry.
          if (status >= 400 && status < 500 && status !== 429) break;
          await new Promise((r) => setTimeout(r, 2000 * (tryNo + 1)));
        }
      }
      saveToDevice(result.file);
      notify(t("recordingDownloaded"), "error");
    },
    [t]
  );

  /** Finishes the recording file now; returns it for upload (not yet sent). */
  const finishRecording = useCallback(async () => {
    const r = recorder.current;
    if (!r) return null;
    recorder.current = null;
    patch({ recording: false });
    const result = await r.rec.stop();
    r.sources.forEach((s) => s.disconnect());
    r.context.close().catch(() => undefined);
    setCallRecording(r.callId, false).catch(() => undefined);
    return result ? { result, target: { callId: r.callId, conversationId: r.conversationId } } : null;
  }, [patch]);

  const stopRecording = useCallback(
    async (reason: "user" | "limit") => {
      const done = await finishRecording();
      if (done) await deliverRecording(done.result, done.target, reason);
    },
    [deliverRecording, finishRecording]
  );

  // Not async up to the AudioContext: Safari only lets audio start inside the
  // click that asked for it.
  const startRecording = useCallback(() => {
    const call = currentRef.current;
    const room = call?.room;
    if (!call || !room || !call.callId || recorder.current) return;
    let context: AudioContext | null = null;
    try {
      context = new AudioContext();
      context.resume().catch(() => undefined);
      const destination = context.createMediaStreamDestination();
      const rec = recordAudio(destination.stream, {
        context,
        bitrate: RECORDING_BITRATE,
        fileName: stampedName("call-recording"),
        maxMs: MAX_RECORDING_MS,
        maxBytes: RECORDING_MAX_BYTES,
        onLimit: () => stopRecording("limit"),
      });
      recorder.current = { rec, context, destination, sources: new Map(), callId: call.callId, conversationId: call.conversationId };
      // Everything already playing goes into the mix; tracks that arrive later
      // are added by the room listeners.
      addToMix("local-mic", room.localParticipant.getTrackPublication("microphone" as never)?.track?.mediaStreamTrack);
      room.remoteParticipants.forEach((p) =>
        p.trackPublications.forEach((pub) => {
          if (pub.kind === "audio" && pub.track) addToMix(pub.trackSid, pub.track.mediaStreamTrack);
        })
      );
      patch({ recording: true });
      // Everyone sees the red "recording" badge, including people who join later.
      setCallRecording(call.callId, true).catch(() => undefined);
    } catch {
      recorder.current = null;
      context?.close().catch(() => undefined);
      notify(t("recordingUnsupported"), "error");
    }
  }, [addToMix, patch, stopRecording, t]);

  // ── Leaving ───────────────────────────────────────────────────────────────

  /**
   * Ends this tab's part in the call. `tellServer` is false when another tab
   * took the call over (same person, so they haven't left).
   */
  const hangUp = useCallback(
    async (notice?: string, tellServer = true) => {
      const call = currentRef.current;
      if (!call || leaving.current) return;
      leaving.current = true;
      attempt.current += 1;
      stopTone();
      clearTimers();
      // Close the file first (instant), then leave the room at once: hanging
      // up must never wait on an upload with the mic still live.
      const pending = await finishRecording().catch(() => null);
      try {
        await call.room?.disconnect();
      } finally {
        audioHost.current?.replaceChildren();
        setCurrent(null);
        leaving.current = false;
        if (tellServer && call.callId) leaveCall(call.callId).catch(() => undefined);
        if (notice) notify(notice, "info");
      }
      if (pending) deliverRecording(pending.result, pending.target, "user");
    },
    [clearTimers, deliverRecording, finishRecording, stopTone]
  );

  /** In a DM, being alone for a few seconds means the call is over. */
  const watchAloneInDm = useCallback(
    (room: Room) => {
      if (aloneTimer.current) clearTimeout(aloneTimer.current);
      aloneTimer.current = null;
      const cur = currentRef.current;
      if (!cur || cur.room !== room || cur.conversationType !== "dm" || cur.phase === "ringing") return;
      if (room.remoteParticipants.size > 0) return;
      aloneTimer.current = setTimeout(() => {
        const now = currentRef.current;
        if (now?.room === room && room.remoteParticipants.size === 0) hangUp(t("callEnded"));
      }, DM_ALONE_GRACE_MS);
    },
    [hangUp, t]
  );

  // ── Joining ───────────────────────────────────────────────────────────────

  const start = useCallback(
    async (conversationId: string, video: boolean, meta: StartMeta) => {
      const existing = currentRef.current;
      if (existing) {
        if (existing.conversationId !== conversationId) notify(t("alreadyInCall"), "error");
        return;
      }
      const myAttempt = ++attempt.current;
      const superseded = () => attempt.current !== myAttempt;
      setIncoming(null);
      stopTone();
      setCurrent({
        callId: "",
        conversationId,
        conversationName: meta.name,
        conversationType: meta.type,
        phase: "connecting",
        room: null,
        connectedAt: null,
        recording: false,
        audioBlocked: false,
      });

      let room: Room | null = null;
      let joinedCallId: string | null = null;
      try {
        const [join, lk] = await Promise.all([startOrJoinCall(conversationId, video, meta.callId), import("livekit-client")]);
        joinedCallId = join.callId;
        // Hung up while the server was still answering.
        if (superseded()) {
          leaveCall(join.callId).catch(() => undefined);
          return;
        }
        const { Room: LkRoom, RoomEvent, Track, VideoPresets, DisconnectReason } = lk;
        room = new LkRoom({
          adaptiveStream: true,
          dynacast: true,
          audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          videoCaptureDefaults: { resolution: VideoPresets.h720.resolution },
          publishDefaults: { simulcast: true },
        });
        const thisRoom = room;

        thisRoom
          .on(RoomEvent.TrackSubscribed, (track: RemoteTrack, pub: RemoteTrackPublication) => {
            if (track.kind !== Track.Kind.Audio) return;
            const el = track.attach();
            audioHost.current?.appendChild(el);
            addToMix(pub.trackSid, track.mediaStreamTrack);
          })
          .on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack, pub: RemoteTrackPublication) => {
            track.detach().forEach((el) => el.remove());
            removeFromMix(pub.trackSid);
          })
          .on(RoomEvent.LocalTrackPublished, (pub: LocalTrackPublication) => {
            if (pub.source === Track.Source.Microphone) addToMix("local-mic", pub.track?.mediaStreamTrack);
          })
          .on(RoomEvent.ParticipantConnected, () => {
            if (aloneTimer.current) clearTimeout(aloneTimer.current);
            aloneTimer.current = null;
            if (currentRef.current?.phase === "ringing") {
              stopTone();
              if (ringTimer.current) clearTimeout(ringTimer.current);
              patch({ phase: "live", connectedAt: Date.now() });
            }
          })
          // A DM is a phone call: when the other person hangs up, it's over.
          .on(RoomEvent.ParticipantDisconnected, () => watchAloneInDm(thisRoom))
          .on(RoomEvent.Reconnecting, () => patch({ phase: "reconnecting" }))
          .on(RoomEvent.Reconnected, () => patch({ phase: "live" }))
          .on(RoomEvent.AudioPlaybackStatusChanged, () => patch({ audioBlocked: !thisRoom.canPlaybackAudio }))
          .on(RoomEvent.Disconnected, (reason?: number) => {
            // Our own hang-up goes through hangUp(); anything else (another
            // tab took over, room closed, network gone for good) ends it here.
            if (leaving.current || currentRef.current?.room !== thisRoom) return;
            if (reason === DisconnectReason.DUPLICATE_IDENTITY) {
              hangUp(t("callMovedTab"), false);
              return;
            }
            const closed = reason === DisconnectReason.ROOM_DELETED || reason === DisconnectReason.ROOM_CLOSED || reason === DisconnectReason.PARTICIPANT_REMOVED;
            hangUp(closed ? t("callEnded") : t("callFailed"));
          });

        setCurrent((cur) => (cur && !superseded() ? { ...cur, callId: join.callId, room: thisRoom } : cur));
        await thisRoom.connect(join.url, join.token);
        if (superseded()) {
          await thisRoom.disconnect();
          leaveCall(join.callId).catch(() => undefined);
          return;
        }

        try {
          await thisRoom.localParticipant.setMicrophoneEnabled(true);
        } catch {
          notify(t("micDenied"), "error");
        }
        if (video) {
          try {
            await thisRoom.localParticipant.setCameraEnabled(true);
          } catch {
            notify(t("cameraDenied"), "error");
          }
        }
        if (superseded()) return;

        const alone = thisRoom.remoteParticipants.size === 0;
        if (alone && join.created && callRings(meta.type)) {
          patch({ phase: "ringing", audioBlocked: !thisRoom.canPlaybackAudio });
          tone.current = startTone("ringback");
          ringTimer.current = setTimeout(() => {
            if (currentRef.current?.room === thisRoom && thisRoom.remoteParticipants.size === 0) hangUp(t("noAnswer"));
          }, RING_TIMEOUT_MS);
        } else {
          patch({ phase: "live", connectedAt: Date.now(), audioBlocked: !thisRoom.canPlaybackAudio });
          // Joined a DM call whose caller already left: don't sit there alone.
          setTimeout(() => watchAloneInDm(thisRoom), 0);
        }
      } catch (e) {
        await room?.disconnect().catch(() => undefined);
        if (joinedCallId) leaveCall(joinedCallId).catch(() => undefined);
        if (superseded()) return;
        setCurrent(null);
        const err = e as { status?: number; message?: string } | null;
        const ended = err?.status === 400 && /call_ended/.test(err?.message ?? "");
        notify(ended ? t("callEnded") : err?.status === 429 ? t("rateLimited") : t("callFailed"), ended ? "info" : "error");
      }
    },
    [addToMix, hangUp, patch, removeFromMix, stopTone, t, watchAloneInDm]
  );

  // ── Signals: rings, declines, call state ──────────────────────────────────

  useEffect(() => {
    const loading = signaledWhileLoading.current;
    return subscribe(`private-chat-${meId}`, "call", async (data: CallSignal) => {
      if (!data?.callId) return;
      const call = currentRef.current;

      if (data.kind === "ring") {
        if (call?.callId === data.callId || incomingRef.current?.id === data.callId) return;
        loading.add(`ring:${data.callId}`);
        try {
          let info = await getCallInfo(data.callId);
          // The caller may have hung up while we were looking it up.
          if (loading.has(data.callId)) info = await getCallInfo(data.callId);
          if (!info.active || info.startedBy?.id === meId) return;
          setIncoming(info);
          if (!currentRef.current) {
            stopTone();
            tone.current = startTone("ring");
          }
        } catch {
          /* gone already */
        } finally {
          loading.delete(`ring:${data.callId}`);
          loading.delete(data.callId);
        }
        return;
      }

      if (loading.has(`ring:${data.callId}`)) loading.add(data.callId);

      if (data.kind === "declined") {
        if (data.userId === meId) {
          if (incomingRef.current?.id === data.callId) {
            setIncoming(null);
            stopTone();
          }
        } else if (call?.callId === data.callId && call.conversationType === "dm") {
          hangUp(t("callDeclined"));
        }
        return;
      }

      // "state": somebody joined/left, or the call ended.
      if (incomingRef.current?.id === data.callId) {
        if (data.userId === meId) {
          // Picked up in another tab.
          setIncoming(null);
          stopTone();
          return;
        }
        try {
          const info = await getCallInfo(data.callId);
          if (!info.active) {
            setIncoming(null);
            stopTone();
          }
        } catch {
          setIncoming(null);
          stopTone();
        }
      }
    });
  }, [hangUp, meId, stopTone, t]);

  // A ring nobody answers stops on its own.
  useEffect(() => {
    if (!incoming) return;
    const handle = setTimeout(() => {
      setIncoming(null);
      stopTone();
    }, RING_TIMEOUT_MS + 5000);
    return () => clearTimeout(handle);
  }, [incoming, stopTone]);

  // Closing the tab: leave cleanly, and warn first if a recording would be lost.
  useEffect(() => {
    if (!current?.callId) return;
    const callId = current.callId;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (recorder.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const onPageHide = () => {
      currentRef.current?.room?.disconnect();
      navigator.sendBeacon?.(`/api/chat/calls/${callId}/leave`);
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [current?.callId]);

  // Leaving the dashboard altogether: nothing may keep the mic open.
  useEffect(
    () => () => {
      stopTone();
      clearTimers();
      const r = recorder.current;
      recorder.current = null;
      r?.rec.cancel();
      r?.context.close().catch(() => undefined);
      const call = currentRef.current;
      call?.room?.disconnect();
      if (call?.callId) navigator.sendBeacon?.(`/api/chat/calls/${call.callId}/leave`);
    },
    [clearTimers, stopTone]
  );

  const value = useMemo(() => ({ current, start }), [current, start]);

  return (
    <CallsContext.Provider value={value}>
      {children}
      <div ref={audioHost} className="hidden" aria-hidden />
      {current && (
        <CallWindow
          call={current}
          onLeave={() => hangUp()}
          onToggleRecording={() => (current.recording ? stopRecording("user") : startRecording())}
          onEnableAudio={() => current.room?.startAudio().then(() => patch({ audioBlocked: false }))}
        />
      )}
      {incoming && (
        <IncomingCall
          info={incoming}
          busy={Boolean(current)}
          onAccept={(video) => {
            const info = incoming;
            setIncoming(null);
            stopTone();
            start(info.conversationId, video, { name: info.conversationName ?? "", type: info.conversationType, callId: info.id });
          }}
          onDecline={() => {
            const info = incoming;
            setIncoming(null);
            stopTone();
            declineCall(info.id).catch(() => undefined);
          }}
        />
      )}
    </CallsContext.Provider>
  );
}
