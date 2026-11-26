"use client";

/**
 * Ring tones synthesised with Web Audio, so there are no audio files to ship.
 * "ring" is the incoming call; "ringback" is what the caller hears while it
 * rings on the other side. If the browser hasn't allowed sound yet (no click
 * on the page so far) this is silently a no-op — the card still shows.
 */
export type Tone = { stop: () => void };

export function startTone(kind: "ring" | "ringback"): Tone {
  let context: AudioContext | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  try {
    context = new AudioContext();
  } catch {
    return { stop: () => undefined };
  }
  const ctx = context;
  const volume = kind === "ring" ? 0.12 : 0.05;
  const notes = kind === "ring" ? [880, 660] : [440];

  const burst = () => {
    if (ctx.state === "suspended") ctx.resume().catch(() => undefined);
    const now = ctx.currentTime;
    notes.forEach((freq, i) => {
      for (let rep = 0; rep < (kind === "ring" ? 2 : 1); rep++) {
        const startAt = now + rep * 0.5 + i * 0.18;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, startAt);
        gain.gain.linearRampToValueAtTime(volume, startAt + 0.02);
        gain.gain.linearRampToValueAtTime(0, startAt + (kind === "ring" ? 0.16 : 1.2));
        osc.connect(gain).connect(ctx.destination);
        osc.start(startAt);
        osc.stop(startAt + 1.3);
      }
    });
  };

  burst();
  timer = setInterval(burst, kind === "ring" ? 2200 : 3000);
  return {
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
      ctx.close().catch(() => undefined);
    },
  };
}
