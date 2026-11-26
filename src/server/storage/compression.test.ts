import { gunzipSync } from "zlib";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { MAX_IMAGE_EDGE, compressForStorage, optimizeImage, runExclusive, stripJpegMetadata } from "./compression";

/** A noisy photo-like image, so encoders can't cheat with flat colour. */
async function photo(width: number, height: number, withGps = false) {
  const raw = Buffer.alloc(width * height * 3);
  for (let i = 0; i < raw.length; i++) raw[i] = (i * 7 + ((i / 3) % width) * 3) % 256;
  let img = sharp(raw, { raw: { width, height, channels: 3 } });
  if (withGps) img = img.withExif({ IFD3: { GPSLatitudeRef: "N", GPSLatitude: "30/1 2/1 0/1" }, IFD0: { Model: "Phone X" } });
  return new Uint8Array(await img.jpeg({ quality: 98 }).toBuffer());
}

describe("optimizeImage", () => {
  it("shrinks a big photo to the max edge and makes it smaller", async () => {
    const input = await photo(4000, 3000);
    const out = await optimizeImage(input, "image/jpeg");
    const meta = await sharp(out.bytes).metadata();
    expect(out.changed).toBe(true);
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBe(MAX_IMAGE_EDGE);
    expect(out.bytes.length).toBeLessThan(input.length / 2);
  });

  it("drops EXIF (GPS, phone model) from photos", async () => {
    const input = await photo(800, 600, true);
    expect((await sharp(input).metadata()).exif).toBeDefined();
    const out = await optimizeImage(input, "image/jpeg");
    expect((await sharp(out.bytes).metadata()).exif).toBeUndefined();
  });

  it("never enlarges small images", async () => {
    const out = await optimizeImage(await photo(300, 200), "image/jpeg");
    const meta = await sharp(out.bytes).metadata();
    expect([meta.width, meta.height]).toEqual([300, 200]);
  });

  it("keeps a PNG lossless and never makes it bigger", async () => {
    const input = new Uint8Array(await sharp({ create: { width: 500, height: 500, channels: 4, background: { r: 10, g: 200, b: 30, alpha: 0.5 } } }).png({ compressionLevel: 0 }).toBuffer());
    const out = await optimizeImage(input, "image/png");
    expect(out.bytes.length).toBeLessThanOrEqual(input.length);
    const a = await sharp(input).raw().toBuffer();
    const b = await sharp(out.bytes).raw().toBuffer();
    expect(Buffer.compare(a, b)).toBe(0);
  });

  it("leaves animated PNGs alone", async () => {
    // Signature + a fake acTL chunk is enough for the check.
    const apng = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 8, 0x61, 0x63, 0x54, 0x4c, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0]);
    const out = await optimizeImage(apng, "image/png");
    expect(out.changed).toBe(false);
    expect(out.bytes).toBe(apng);
  });

  it("falls back to the original on a corrupt image", async () => {
    const junk = new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3, 4, 5]);
    const out = await optimizeImage(junk, "image/jpeg");
    expect(out.changed).toBe(false);
    expect(out.bytes).toBe(junk);
  });

  it("ignores formats it doesn't handle", async () => {
    const gif = new TextEncoder().encode("GIF89a....");
    expect((await optimizeImage(gif, "image/gif")).bytes).toBe(gif);
  });
});

describe("compressForStorage", () => {
  it("gzips text and gets the exact bytes back", async () => {
    const text = new TextEncoder().encode("name,phone,city\n".repeat(2000));
    const stored = await compressForStorage(text, "text/plain");
    expect(stored.encoding).toBe("gzip");
    expect(stored.bytes.length).toBeLessThan(text.length / 5);
    expect(Buffer.compare(gunzipSync(stored.bytes), Buffer.from(text))).toBe(0);
  });

  it("skips media, archives, PDFs and unknown binaries", async () => {
    const bytes = new Uint8Array(5000);
    for (const mime of ["image/jpeg", "video/mp4", "audio/ogg", "application/zip", "application/pdf", "application/octet-stream"]) {
      expect((await compressForStorage(bytes, mime)).encoding).toBe("identity");
    }
  });

  it("skips data that doesn't shrink, judging big files by a sample", async () => {
    const random = new Uint8Array(300_000).map(() => Math.floor(Math.random() * 256));
    expect((await compressForStorage(random, "application/x-ole-storage")).encoding).toBe("identity");
  });
});

describe("GPS never survives", () => {
  it("strips EXIF from a JPEG without touching its pixels", async () => {
    const input = await photo(200, 150, true);
    const stripped = stripJpegMetadata(input);
    expect((await sharp(stripped).metadata()).exif).toBeUndefined();
    const a = await sharp(input).raw().toBuffer();
    const b = await sharp(stripped).raw().toBuffer();
    expect(Buffer.compare(a, b)).toBe(0);
  });

  it("strips EXIF even when a JPEG is too large to re-encode", async () => {
    // Header claims a huge image: the decoder refuses it, the fallback runs.
    const input = await photo(200, 150, true);
    const out = await optimizeImage(input, "image/jpeg", { maxEdge: 100 });
    expect((await sharp(out.bytes).metadata()).exif).toBeUndefined();
    const broken = input.slice(0, input.length - 200);
    const fallback = await optimizeImage(broken, "image/jpeg");
    expect(Buffer.from(fallback.bytes).includes(Buffer.from("Phone X"))).toBe(false);
  });
});

describe("runExclusive", () => {
  it("runs jobs one at a time, in order, even when one fails", async () => {
    let running = 0;
    let maxRunning = 0;
    const order: number[] = [];
    const job = (n: number, fail = false) => () =>
      new Promise<number>((resolve, reject) => {
        running++;
        maxRunning = Math.max(maxRunning, running);
        setTimeout(() => {
          running--;
          order.push(n);
          if (fail) reject(new Error("x"));
          else resolve(n);
        }, 5);
      });
    const results = await Promise.allSettled([runExclusive(job(1)), runExclusive(job(2, true)), runExclusive(job(3))]);
    expect(maxRunning).toBe(1);
    expect(order).toEqual([1, 2, 3]);
    expect(results.map((r) => r.status)).toEqual(["fulfilled", "rejected", "fulfilled"]);
  });
});
