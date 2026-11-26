import { gzip } from "zlib";
import { promisify } from "util";
import sharp from "sharp";

/**
 * Shrinks uploads before they hit the disk.
 *
 * - Photos (JPEG/WebP) are resized to fit MAX_IMAGE_EDGE and re-encoded at a
 *   quality that is visually lossless; PNGs are recompressed losslessly. EXIF
 *   is always dropped from JPEGs — it carries the phone's GPS position.
 * - Formats that aren't compressed already (text, CSV, old Office files…)
 *   are stored gzipped and decompressed on the way out, byte-for-byte.
 * - Video and audio are left alone: re-encoding them would tie up this
 *   server's two cores for minutes.
 *
 * Everything runs one image at a time for the whole process (see runExclusive)
 * so a burst of uploads can't starve the database and call server sharing
 * this two-core host. Every step is best-effort: on failure the original
 * bytes (already through the security checks) are stored.
 */

// One libvips thread per image and no cache of decoded images between jobs.
sharp.concurrency(1);
sharp.cache(false);

export const MAX_IMAGE_EDGE = 2560;
/** Refuse decompression bombs: a tiny file that decodes to gigapixels. ~50 MP still fits big phone photos. */
export const MAX_INPUT_PIXELS = 50_000_000;

const gzipAsync = promisify(gzip);

// ── One image job at a time ────────────────────────────────────────────────

let tail: Promise<unknown> = Promise.resolve();

/** Runs image work strictly one after another across the whole process. */
export function runExclusive<T>(job: () => Promise<T>): Promise<T> {
  const run = tail.then(job, job);
  tail = run.catch(() => undefined);
  return run;
}

// ── JPEG metadata strip (fallback) ─────────────────────────────────────────

/**
 * Removes EXIF/XMP (APP1) and Photoshop (APP13) segments without touching the
 * pixels — used when a JPEG can't be re-encoded, so its GPS still never stays.
 */
export function stripJpegMetadata(bytes: Uint8Array): Uint8Array {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return bytes;
  const keep: Uint8Array[] = [bytes.subarray(0, 2)];
  let i = 2;
  while (i + 4 <= bytes.length && bytes[i] === 0xff) {
    const marker = bytes[i + 1];
    // Start of scan: everything after is image data.
    if (marker === 0xda) break;
    const length = (bytes[i + 2] << 8) | bytes[i + 3];
    if (length < 2 || i + 2 + length > bytes.length) return bytes;
    if (marker !== 0xe1 && marker !== 0xed) keep.push(bytes.subarray(i, i + 2 + length));
    i += 2 + length;
  }
  keep.push(bytes.subarray(i));
  const out = new Uint8Array(keep.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const part of keep) {
    out.set(part, o);
    o += part.length;
  }
  return out;
}

// ── Images ─────────────────────────────────────────────────────────────────

export type OptimizedImage = { bytes: Uint8Array; changed: boolean; width?: number; height?: number };

/** An APNG has an "acTL" chunk before its first image data chunk. */
function isAnimatedPng(bytes: Uint8Array): boolean {
  let offset = 8;
  while (offset + 8 <= bytes.length) {
    const length = ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
    const type = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);
    if (type === "acTL") return true;
    if (type === "IDAT" || type === "IEND") return false;
    offset += 12 + length;
  }
  return false;
}

const view = (b: Buffer) => new Uint8Array(b.buffer, b.byteOffset, b.length);

export function optimizeImage(input: Uint8Array, mime: string, opts: { maxEdge?: number; quality?: number } = {}): Promise<OptimizedImage> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(mime)) return Promise.resolve({ bytes: input, changed: false });
  if (mime === "image/png" && isAnimatedPng(input)) return Promise.resolve({ bytes: input, changed: false });
  const maxEdge = opts.maxEdge ?? MAX_IMAGE_EDGE;
  const quality = opts.quality ?? 82;

  return runExclusive(async () => {
    try {
      // Re-encoding keeps only the first frame: leave animations as they are.
      if (mime === "image/webp" && ((await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS }).metadata()).pages ?? 1) > 1) {
        return { bytes: input, changed: false };
      }
      const pipeline = sharp(input, { failOn: "error", limitInputPixels: MAX_INPUT_PIXELS })
        // Bake the EXIF orientation into the pixels before EXIF is dropped.
        .rotate()
        .resize({ width: maxEdge, height: maxEdge, fit: "inside", withoutEnlargement: true });
      const { data, info } =
        mime === "image/jpeg"
          ? await pipeline.jpeg({ quality, mozjpeg: true }).toBuffer({ resolveWithObject: true })
          : mime === "image/webp"
            ? await pipeline.webp({ quality }).toBuffer({ resolveWithObject: true })
            : await pipeline.png({ compressionLevel: 6 }).toBuffer({ resolveWithObject: true });
      // A JPEG is always taken (it drops the GPS); others only when smaller.
      if (mime !== "image/jpeg" && data.length >= input.length) return { bytes: input, changed: false };
      return { bytes: view(data), changed: true, width: info.width, height: info.height };
    } catch (error) {
      console.error("Image optimization skipped:", error instanceof Error ? error.message : error);
      // Couldn't re-encode (too big, truncated…): still never keep a photo's GPS.
      if (mime === "image/jpeg") {
        const stripped = stripJpegMetadata(input);
        return { bytes: stripped, changed: stripped !== input };
      }
      return { bytes: input, changed: false };
    }
  });
}

// ── Other files ────────────────────────────────────────────────────────────

/** Already compressed (or unknown binary, which usually is) — gzip would only waste CPU. */
const INCOMPRESSIBLE = /^(image|video|audio)\/|^application\/(zip|gzip|pdf|x-rar-compressed|x-7z-compressed|octet-stream)$/;
const SAMPLE_BYTES = 64 * 1024;

export type StoredFile = { bytes: Uint8Array; encoding: "identity" | "gzip" };

/**
 * Gzips a file for storage when that saves at least 10%. Asynchronous (zlib's
 * thread pool), and a 64 KB sample is tried first so a file that won't shrink
 * costs almost nothing.
 */
export async function compressForStorage(input: Uint8Array, mime: string): Promise<StoredFile> {
  if (INCOMPRESSIBLE.test(mime) || input.length < 1024) return { bytes: input, encoding: "identity" };
  try {
    if (input.length > SAMPLE_BYTES * 2) {
      const sample = await gzipAsync(input.subarray(0, SAMPLE_BYTES), { level: 6 });
      if (sample.length > SAMPLE_BYTES * 0.85) return { bytes: input, encoding: "identity" };
    }
    const out = await gzipAsync(input, { level: 6 });
    if (out.length > input.length * 0.9) return { bytes: input, encoding: "identity" };
    return { bytes: view(out), encoding: "gzip" };
  } catch {
    return { bytes: input, encoding: "identity" };
  }
}
