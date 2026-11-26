import { describe, expect, it } from "vitest";
import {
  WAVEFORM_BARS,
  callIdFromRoom,
  callRings,
  callRoomName,
  cleanDurationMs,
  cleanWaveform,
  decodeWaveform,
  encodeWaveform,
  formatDuration,
  isMediaMessageKind,
  isMissedCall,
  isRecordedAudioMime,
  MAX_RECORDING_MS,
  MAX_VOICE_MS,
} from "@/lib/chat/media";
import { inspectUploadedFile } from "@/server/chat/fileSecurity";

describe("waveform", () => {
  it("encodes any number of levels into a fixed number of bars", () => {
    expect(encodeWaveform(Array.from({ length: 1000 }, (_, i) => (i % 10) / 10))).toHaveLength(WAVEFORM_BARS);
    expect(encodeWaveform([0.5])).toHaveLength(WAVEFORM_BARS);
    expect(encodeWaveform([])).toBe("");
  });

  it("keeps each bar's peak and round-trips within one step", () => {
    const levels = [0, 0, 1, 0, 0.5, 0.5];
    const decoded = decodeWaveform(encodeWaveform(levels, 3));
    expect(decoded).toHaveLength(3);
    expect(decoded[0]).toBeCloseTo(0, 5);
    expect(decoded[1]).toBeCloseTo(1, 5);
    expect(Math.abs(decoded[2] - 0.5)).toBeLessThanOrEqual(1 / 31);
  });

  it("clamps garbage levels instead of producing invalid digits", () => {
    const encoded = encodeWaveform([NaN, -3, 7, Infinity], 4);
    expect(cleanWaveform(encoded)).toBe(encoded);
  });

  it("only accepts short base-32 strings from clients", () => {
    expect(cleanWaveform("0av9")).toBe("0av9");
    expect(cleanWaveform("<script>")).toBeNull();
    expect(cleanWaveform("w")).toBeNull();
    expect(cleanWaveform("a".repeat(65))).toBeNull();
    expect(cleanWaveform(42)).toBeNull();
    expect(decodeWaveform("not valid!")).toEqual([]);
  });
});

describe("durations", () => {
  it("clamps client-reported lengths to the kind's limit", () => {
    expect(cleanDurationMs("1234.6", "voice")).toBe(1235);
    expect(cleanDurationMs(MAX_VOICE_MS * 10, "voice")).toBe(MAX_VOICE_MS);
    expect(cleanDurationMs(MAX_RECORDING_MS * 2, "recording")).toBe(MAX_RECORDING_MS);
    expect(cleanDurationMs("-5", "voice")).toBeNull();
    expect(cleanDurationMs("abc", "voice")).toBeNull();
    expect(cleanDurationMs(null, "voice")).toBeNull();
  });

  it("formats minutes and hours", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(65_000)).toBe("1:05");
    expect(formatDuration(3_725_000)).toBe("1:02:05");
    expect(formatDuration(null)).toBe("0:00");
  });
});

describe("message kinds and formats", () => {
  it("knows the media kinds", () => {
    expect(isMediaMessageKind("voice")).toBe(true);
    expect(isMediaMessageKind("recording")).toBe(true);
    expect(isMediaMessageKind("call")).toBe(false);
    expect(isMediaMessageKind("system")).toBe(false);
  });

  it("accepts what MediaRecorder produces and nothing else", () => {
    for (const mime of ["video/webm", "audio/ogg", "audio/mp4", "video/mp4"]) expect(isRecordedAudioMime(mime)).toBe(true);
    for (const mime of ["application/pdf", "image/png", "text/plain"]) expect(isRecordedAudioMime(mime)).toBe(false);
  });

  it("lets a recorded WebM voice note through the upload checks", () => {
    const webm = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, ...new Array(64).fill(1)]);
    const result = inspectUploadedFile({ name: "voice-20261126-120000.webm", bytes: webm });
    expect(result.ok && isRecordedAudioMime(result.mimeType)).toBe(true);
  });

  it("rejects a PDF dressed up as a voice note", () => {
    const pdf = new TextEncoder().encode("%PDF-1.7 fake");
    const result = inspectUploadedFile({ name: "voice.webm", bytes: pdf });
    expect(result.ok).toBe(false);
  });
});

describe("calls", () => {
  const id = "3f2b8c1e-9d4a-4b6e-8f00-1234567890ab";

  it("maps call ids to room names and back", () => {
    expect(callIdFromRoom(callRoomName(id))).toBe(id);
    expect(callIdFromRoom("call-../../etc")).toBeNull();
    expect(callIdFromRoom("other-room")).toBeNull();
    expect(callIdFromRoom(undefined)).toBeNull();
  });

  it("rings DMs and groups but not channels", () => {
    expect(callRings("dm")).toBe(true);
    expect(callRings("group")).toBe(true);
    expect(callRings("channel")).toBe(false);
  });

  it("calls a DM nobody answered a missed call", () => {
    const ended = new Date();
    expect(isMissedCall({ endedAt: ended, participantIds: ["a"] }, "dm")).toBe(true);
    expect(isMissedCall({ endedAt: ended, participantIds: ["a", "a"] }, "dm")).toBe(true);
    expect(isMissedCall({ endedAt: ended, participantIds: ["a", "b"] }, "dm")).toBe(false);
    expect(isMissedCall({ endedAt: null, participantIds: ["a"] }, "dm")).toBe(false);
    expect(isMissedCall({ endedAt: ended, participantIds: ["a"] }, "group")).toBe(false);
  });
});
