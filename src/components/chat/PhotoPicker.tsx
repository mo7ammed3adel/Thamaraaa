"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { PhotoCropper } from "./PhotoCropper";

/** Upload limit before the server re-draws the photo at 256px. */
const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Wraps a picture with "change photo" (camera badge) and "remove". The parent
 * does the upload; this only picks, validates size and shows progress.
 */
export function PhotoPicker({
  children,
  hasPhoto,
  labels,
  onPick,
  onRemove,
  onError,
  round = false,
}: {
  children: React.ReactNode;
  hasPhoto: boolean;
  labels: { change: string; remove: string; tooLarge: string };
  onPick: (file: File) => Promise<void>;
  onRemove: () => Promise<void>;
  onError: (message: string) => void;
  round?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  /** Picked, waiting in the crop/zoom dialog. */
  const [picked, setPicked] = useState<File | null>(null);

  async function run(task: () => Promise<void>) {
    setBusy(true);
    try {
      await task();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="group relative">
        {children}
        <button
          type="button"
          disabled={busy}
          onClick={() => input.current?.click()}
          title={labels.change}
          aria-label={labels.change}
          data-testid="photo-change"
          className={`absolute inset-0 flex items-center justify-center bg-black/0 text-white transition hover:bg-black/45 ${round ? "rounded-full" : "rounded-xl"}`}
        >
          <span className={`opacity-0 transition group-hover:opacity-100 ${busy ? "opacity-100" : ""}`}>
            {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <Camera className="h-6 w-6" />}
          </span>
        </button>
        <span className="pointer-events-none absolute -bottom-1 -end-1 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-white shadow ring-2 ring-white">
          <Camera className="h-3.5 w-3.5" />
        </span>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        data-testid="photo-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          if (file.size > MAX_BYTES) return onError(labels.tooLarge);
          setPicked(file);
        }}
      />
      {picked && (
        <PhotoCropper
          file={picked}
          onCancel={() => setPicked(null)}
          onDone={(cropped) => {
            setPicked(null);
            run(() => onPick(cropped));
          }}
        />
      )}
      {hasPhoto && (
        <button
          type="button"
          disabled={busy}
          onClick={() => run(onRemove)}
          className="flex items-center gap-1 rounded-md px-2 py-0.5 text-xs text-slate-500 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
        >
          <Trash2 className="h-3 w-3" /> {labels.remove}
        </button>
      )}
    </div>
  );
}
