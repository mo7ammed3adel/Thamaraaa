"use client";

import { encodeWaveform } from "./media";

/**
 * Records an audio stream in the browser with MediaRecorder and keeps a level
 * history for the waveform. Used for voice notes (the mic) and for call
 * recordings (a mix of everyone's audio).
 */

/** First container this browser can record: Opus in WebM/Ogg, or AAC in MP4 (Safari). */
export function pickAudioMime(): { mimeType: string; ext: string } | null {
  if (typeof MediaRecorder === "undefined") return null;
  const options = [
    { mimeType: "audio/webm;codecs=opus", ext: "webm" },
    { mimeType: "audio/webm", ext: "webm" },
    { mimeType: "audio/ogg;codecs=opus", ext: "ogg" },
    { mimeType: "audio/mp4", ext: "m4a" },
  ];
  return options.find((o) => MediaRecorder.isTypeSupported(o.mimeType)) ?? null;
}

export type RecordingResult = { file: File; durationMs: number; waveform: string };

export type AudioRecording = {
  /** Finishes and returns the file, or null if nothing usable was captured. */
  stop: () => Promise<RecordingResult | null>;
  cancel: () => void;
  elapsedMs: () => number;
  /** Current input level, 0..1, for a live meter. */
  level: () => number;
};

export function recordAudio(
  stream: MediaStream,
  opts: {
    bitrate: number;
    fileName: string;
    maxMs: number;
    /** Stop before the upload limit, whatever bitrate the browser really used. */
    maxBytes?: number;
    onLimit?: () => void;
    context?: AudioContext;
  }
): AudioRecording {
  const format = pickAudioMime();
  if (!format) throw new Error("recording_unsupported");

  const ownContext = !opts.context;
  const context = opts.context ?? new AudioContext();
  const analyser = context.createAnalyser();
  analyser.fftSize = 1024;
  const source = context.createMediaStreamSource(stream);
  source.connect(analyser);
  const samples = new Float32Array(analyser.fftSize);

  const recorder = new MediaRecorder(stream, { mimeType: format.mimeType, audioBitsPerSecond: opts.bitrate });
  const chunks: Blob[] = [];
  let bytes = 0;
  let limitHit = false;
  const hitLimit = () => {
    if (limitHit) return;
    limitHit = true;
    opts.onLimit?.();
  };
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) {
      chunks.push(e.data);
      bytes += e.data.size;
      if (opts.maxBytes && bytes >= opts.maxBytes) hitLimit();
    }
  };

  const levels: number[] = [];
  let samplesTaken = 0;
  let current = 0;
  const started = performance.now();
  let stoppedAt: number | null = null;

  const sampler = setInterval(() => {
    analyser.getFloatTimeDomainData(samples);
    let peak = 0;
    for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]));
    // Speech rarely peaks above ~0.5; scale so normal talking fills the bars.
    current = Math.min(1, peak * 1.8);
    // Past ~3 minutes keep every 4th sample: the waveform needs only 48 bars.
    samplesTaken += 1;
    if (samplesTaken <= 2000 || samplesTaken % 4 === 0) levels.push(current);
    if (performance.now() - started >= opts.maxMs) hitLimit();
  }, 100);

  // A timeslice keeps memory flat on long recordings and limits loss if the tab dies.
  recorder.start(1000);

  function cleanup() {
    clearInterval(sampler);
    source.disconnect();
    if (ownContext) context.close().catch(() => undefined);
  }

  return {
    elapsedMs: () => (stoppedAt ?? performance.now()) - started,
    level: () => current,
    cancel() {
      stoppedAt = performance.now();
      cleanup();
      if (recorder.state !== "inactive") {
        recorder.ondataavailable = null;
        recorder.stop();
      }
    },
    stop() {
      stoppedAt = performance.now();
      return new Promise((resolve) => {
        const finish = () => {
          cleanup();
          const durationMs = Math.min(stoppedAt! - started, opts.maxMs);
          const blob = new Blob(chunks, { type: format.mimeType.split(";")[0] });
          if (blob.size === 0 || durationMs < 500) return resolve(null);
          resolve({
            file: new File([blob], `${opts.fileName}.${format.ext}`, { type: blob.type }),
            durationMs,
            waveform: encodeWaveform(levels),
          });
        };
        if (recorder.state === "inactive") return finish();
        recorder.onstop = finish;
        recorder.stop();
      });
    },
  };
}

export function stampedName(prefix: string): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${prefix}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}
