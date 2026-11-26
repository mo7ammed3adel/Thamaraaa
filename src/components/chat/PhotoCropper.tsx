"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RotateCw, X, ZoomIn, ZoomOut } from "lucide-react";
import { useChatT } from "./useChatT";

/** Size of the square crop window on screen, and of the exported image. */
const VIEW = 288;
const OUTPUT = 512;
const MAX_ZOOM = 4;

type Pt = { x: number; y: number };

/**
 * Crop dialog for profile/group photos: drag to move, zoom with the slider,
 * the mouse wheel or two fingers, rotate in 90° steps. The circle shows how
 * the photo will look as an avatar. Produces a 512×512 image file.
 */
export function PhotoCropper({ file, onCancel, onDone }: { file: File; onCancel: () => void; onDone: (cropped: File) => void }) {
  const { t } = useChatT();
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0); // 0, 90, 180, 270
  const [offset, setOffset] = useState<Pt>({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const pointers = useRef(new Map<number, Pt>());
  const pinch = useRef<{ distance: number; zoom: number } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    let live = true;
    setFailed(false);
    // Events from an image this effect already cleaned up are ignored (revoking
    // its URL makes it "fail", which must not mark the new one as broken).
    image.onload = () => live && setImg(image);
    image.onerror = () => live && setFailed(true);
    image.src = url;
    return () => {
      live = false;
      image.onload = null;
      image.onerror = null;
      // The <img> on screen reuses the URL; release it once the dialog is gone.
      setTimeout(() => URL.revokeObjectURL(url), 0);
    };
  }, [file]);

  // Image size as displayed once rotated (90°/270° swap width and height).
  const turned = rotation % 180 !== 0;
  const w = img ? (turned ? img.naturalHeight : img.naturalWidth) : 1;
  const h = img ? (turned ? img.naturalWidth : img.naturalHeight) : 1;
  /** Scale at zoom 1: the photo just covers the crop window. */
  const baseScale = VIEW / Math.min(w, h);
  const scale = baseScale * zoom;

  /** Keeps the photo covering the whole window (no empty edges). */
  const clamp = useCallback(
    (p: Pt, s = scale): Pt => {
      const maxX = Math.max(0, (w * s - VIEW) / 2);
      const maxY = Math.max(0, (h * s - VIEW) / 2);
      return { x: Math.min(maxX, Math.max(-maxX, p.x)), y: Math.min(maxY, Math.max(-maxY, p.y)) };
    },
    [scale, w, h]
  );

  const applyZoom = useCallback(
    (next: number) => {
      const z = Math.min(MAX_ZOOM, Math.max(1, next));
      setZoom(z);
      setOffset((o) => clamp(o, baseScale * z));
    },
    [baseScale, clamp]
  );

  useEffect(() => {
    setOffset((o) => clamp(o));
  }, [rotation, clamp]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onCancel]);

  function onPointerDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      pinch.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), zoom };
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const now = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, now);
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = Array.from(pointers.current.values());
      applyZoom(pinch.current.zoom * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.distance));
      return;
    }
    setOffset((o) => clamp({ x: o.x + now.x - prev.x, y: o.y + now.y - prev.y }));
  }

  function onPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  }

  async function save() {
    if (!img) return;
    setSaving(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT;
      canvas.height = OUTPUT;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no canvas");
      const k = OUTPUT / VIEW;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, OUTPUT, OUTPUT);
      // Same transform as on screen, scaled from the window to the output.
      ctx.translate(OUTPUT / 2 + offset.x * k, OUTPUT / 2 + offset.y * k);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(scale * k, scale * k);
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.92));
      if (!blob) throw new Error("export failed");
      onDone(new File([blob], "photo.jpg", { type: "image/jpeg" }));
    } catch {
      setFailed(true);
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm" data-testid="photo-cropper">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <span className="font-bold text-slate-800">{t("cropPhoto")}</span>
          <button onClick={onCancel} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label={t("cancel")}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col items-center gap-4 p-5">
          {failed ? (
            <p className="py-16 text-center text-sm text-rose-600">{t("photoRejected")}</p>
          ) : (
            <div
              className="relative touch-none select-none overflow-hidden rounded-xl bg-slate-900"
              style={{ width: VIEW, height: VIEW, cursor: "grab" }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onWheel={(e) => applyZoom(zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08))}
              data-testid="crop-area"
            >
              {img && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={img.src}
                  alt=""
                  draggable={false}
                  className="pointer-events-none absolute left-1/2 top-1/2 max-w-none"
                  style={{
                    width: img.naturalWidth,
                    height: img.naturalHeight,
                    transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) rotate(${rotation}deg) scale(${scale})`,
                  }}
                />
              )}
              {/* The avatar circle; the corners outside it are dimmed. */}
              <div className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_9999px_rgba(15,23,42,0.55)] ring-2 ring-white/80" />
            </div>
          )}

          <div className="flex w-full items-center gap-3">
            <button type="button" onClick={() => applyZoom(zoom / 1.25)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label={t("zoomOut")}>
              <ZoomOut className="h-4 w-4" />
            </button>
            <input
              type="range"
              min={1}
              max={MAX_ZOOM}
              step={0.01}
              value={zoom}
              onChange={(e) => applyZoom(Number(e.target.value))}
              className="flex-1 accent-emerald-600"
              aria-label={t("zoom")}
              data-testid="crop-zoom"
            />
            <button type="button" onClick={() => applyZoom(zoom * 1.25)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label={t("zoomIn")}>
              <ZoomIn className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => setRotation((r) => (r + 90) % 360)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" title={t("rotate")} aria-label={t("rotate")} data-testid="crop-rotate">
              <RotateCw className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-slate-400">{t("cropHint")}</p>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3">
          <button onClick={onCancel} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
            {t("cancel")}
          </button>
          <button onClick={save} disabled={!img || saving || failed} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50" data-testid="crop-save">
            {t("save")}
          </button>
        </div>
      </div>
    </div>
  );
}
