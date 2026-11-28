import { gzip } from "zlib";
import { promisify } from "util";
import sharp, { type Sharp } from "sharp";

/**
 * Shrinks uploads before they hit the disk.
 *
 * - Photos (JPEG/WebP) are resized to fit MAX_IMAGE_EDGE and re-encoded at a
 *   quality that is visually lossless. PNGs are resized too; a big one that
 *   WebP stores in under half the size (screenshots, photos saved as PNG) is
 *   converted to WebP, the rest stay lossless PNG. EXIF is always dropped from
 *   JPEGs — it carries the phone's GPS position.
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

/** `mimeType` is the stored format, which differs from the upload when a PNG became WebP. */
export type OptimizedImage = { bytes: Uint8Array; mimeType: string; changed: boolean; width?: number; height?: number };

/** A PNG at least this big is worth trying as WebP. */
export const PNG_TO_WEBP_MIN_BYTES = 100 * 1024;
/** Quality for PNGs turned into WebP — a notch above photos, so screenshot text stays crisp. */
const PNG_AS_WEBP_QUALITY = 85;

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
  const unchanged = { bytes: input, mimeType: mime, changed: false };
  if (!["image/jpeg", "image/png", "image/webp"].includes(mime)) return Promise.resolve(unchanged);
  if (mime === "image/png" && isAnimatedPng(input)) return Promise.resolve(unchanged);
  const maxEdge = opts.maxEdge ?? MAX_IMAGE_EDGE;
  const quality = opts.quality ?? 82;

  return runExclusive(async () => {
    try {
      // Re-encoding keeps only the first frame: leave animations as they are.
      if (mime === "image/webp" && ((await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS }).metadata()).pages ?? 1) > 1) {
        return unchanged;
      }
      const pipeline = sharp(input, { failOn: "error", limitInputPixels: MAX_INPUT_PIXELS })
        // Bake the EXIF orientation into the pixels before EXIF is dropped.
        .rotate()
        .resize({ width: maxEdge, height: maxEdge, fit: "inside", withoutEnlargement: true });
      if (mime === "image/png") return await optimizePng(input, pipeline);
      const { data, info } =
        mime === "image/jpeg"
          ? await pipeline.jpeg({ quality, mozjpeg: true }).toBuffer({ resolveWithObject: true })
          : await pipeline.webp({ quality }).toBuffer({ resolveWithObject: true });
      // A JPEG is always taken (it drops the GPS); WebP only when smaller.
      if (mime !== "image/jpeg" && data.length >= input.length) return unchanged;
      return { bytes: view(data), mimeType: mime, changed: true, width: info.width, height: info.height };
    } catch (error) {
      console.error("Image optimization skipped:", error instanceof Error ? error.message : error);
      // Couldn't re-encode (too big, truncated…): still never keep a photo's GPS.
      if (mime === "image/jpeg") {
        const stripped = stripJpegMetadata(input);
        return { bytes: stripped, mimeType: mime, changed: stripped !== input };
      }
      return unchanged;
    }
  });
}

/**
 * Resized lossless PNG, or WebP when the image is big and WebP is under half
 * the size: PNG keeps screenshots and photos at megabytes even after resizing.
 * Small or flat PNGs (icons, logos, diagrams) compress well and stay PNG.
 */
async function optimizePng(input: Uint8Array, pipeline: Sharp): Promise<OptimizedImage> {
  const png = await pipeline.clone().png({ compressionLevel: 6 }).toBuffer({ resolveWithObject: true });
  const bestPng = png.data.length < input.length ? { bytes: view(png.data), changed: true } : { bytes: input, changed: false };
  if (bestPng.bytes.length >= PNG_TO_WEBP_MIN_BYTES) {
    const webp = await pipeline.clone().webp({ quality: PNG_AS_WEBP_QUALITY }).toBuffer({ resolveWithObject: true });
    if (webp.data.length * 2 <= bestPng.bytes.length) {
      return { bytes: view(webp.data), mimeType: "image/webp", changed: true, width: webp.info.width, height: webp.info.height };
    }
  }
  return { ...bestPng, mimeType: "image/png", width: png.info.width, height: png.info.height };
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
