import { MAX_FILE_BYTES } from "@/lib/chat/constants";

/**
 * Security checks for files uploaded to the team chat.
 *
 * The browser's claimed MIME type and the file name are both attacker-chosen,
 * so neither is trusted. The type is decided from the file's first bytes, and
 * only a short list of formats a browser renders safely (images, video, audio,
 * PDF) is ever shown inline; everything else is served as an opaque download.
 */

export type FileCategory = "image" | "video" | "audio" | "pdf" | "document" | "archive" | "other";

export type InspectedFile =
  | {
      ok: true;
      safeName: string;
      mimeType: string;
      category: FileCategory;
      /** True only for formats the attachment route may render in the page. */
      inline: boolean;
    }
  | { ok: false; reason: "empty" | "too_large" | "blocked_type" | "executable" | "type_mismatch" };

/** Extensions that run code when opened, or are common malware wrappers. */
const BLOCKED_EXTENSIONS = new Set([
  "exe", "msi", "msix", "msp", "bat", "cmd", "com", "scr", "pif", "cpl", "dll", "sys", "drv",
  "ps1", "psm1", "psd1", "vbs", "vbe", "js", "jse", "mjs", "wsf", "wsh", "hta", "jar", "lnk",
  "reg", "inf", "scf", "url", "chm", "gadget", "sh", "bash", "appx", "appxbundle", "apk",
  "app", "deb", "rpm", "dmg", "pkg", "iso", "img", "vhd", "vhdx",
  // Office formats that carry macros.
  "xll", "xlam", "docm", "xlsm", "pptm", "dotm", "xlsb", "xltm", "potm", "ppsm", "ppam", "sldm",
  // Windows launchers and script hosts.
  "msc", "wsc", "sct", "jnlp", "application", "appref-ms", "settingcontent-ms", "library-ms",
  "search-ms", "py", "pyw", "pyc", "vb", "ws", "mst", "ins", "isp", "shb", "shs",
]);

/** Extensions that promise a specific media format — the bytes must agree. */
const EXTENSION_EXPECTS: Record<string, string[]> = {
  jpg: ["image/jpeg"], jpeg: ["image/jpeg"], png: ["image/png"], gif: ["image/gif"],
  webp: ["image/webp"], pdf: ["application/pdf"],
  mp4: ["video/mp4"], m4v: ["video/mp4"], mov: ["video/quicktime", "video/mp4"],
  webm: ["video/webm"], mkv: ["video/webm"],
  mp3: ["audio/mpeg"], m4a: ["audio/mp4", "video/mp4"], ogg: ["audio/ogg"], wav: ["audio/wav"],
  docx: ["application/zip"], xlsx: ["application/zip"], pptx: ["application/zip"], zip: ["application/zip"],
};

const ARCHIVE_TYPES = new Set(["application/zip", "application/x-rar-compressed", "application/x-7z-compressed", "application/gzip"]);
const DOCUMENT_EXTENSIONS = new Set(["doc", "docx", "xls", "xlsx", "ppt", "pptx", "csv", "txt", "rtf", "odt", "ods", "odp", "md"]);

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((b, i) => bytes[offset + i] === b);
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...Array.from(bytes.subarray(start, end)));
}

/** True when the bytes are a native program, whatever the file is called. */
export function looksExecutable(bytes: Uint8Array): boolean {
  return (
    startsWith(bytes, [0x4d, 0x5a]) || // MZ — Windows PE
    startsWith(bytes, [0x7f, 0x45, 0x4c, 0x46]) || // ELF
    startsWith(bytes, [0xca, 0xfe, 0xba, 0xbe]) || // Mach-O fat / Java class
    startsWith(bytes, [0xfe, 0xed, 0xfa, 0xce]) ||
    startsWith(bytes, [0xfe, 0xed, 0xfa, 0xcf]) ||
    startsWith(bytes, [0xcf, 0xfa, 0xed, 0xfe]) ||
    startsWith(bytes, [0x23, 0x21]) // "#!" script
  );
}

/** Detects the real format from magic bytes. Returns null when unrecognised. */
export function sniffMimeType(bytes: Uint8Array): string | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (ascii(bytes, 0, 6) === "GIF87a" || ascii(bytes, 0, 6) === "GIF89a") return "image/gif";
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") return "image/webp";
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WAVE") return "audio/wav";
  if (ascii(bytes, 0, 5) === "%PDF-") return "application/pdf";
  if (ascii(bytes, 4, 8) === "ftyp") {
    const brand = ascii(bytes, 8, 12);
    // iPhone photos and AVIF share the ISO container with MP4.
    if (["heic", "heix", "heim", "heis", "mif1", "msf1"].includes(brand)) return "image/heic";
    if (brand === "avif" || brand === "avis") return "image/avif";
    if (brand === "qt  ") return "video/quicktime";
    if (brand.startsWith("M4A")) return "audio/mp4";
    return "video/mp4";
  }
  if (startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3])) return "video/webm";
  if (ascii(bytes, 0, 4) === "OggS") return "audio/ogg";
  if (ascii(bytes, 0, 3) === "ID3" || startsWith(bytes, [0xff, 0xfb]) || startsWith(bytes, [0xff, 0xf3]) || startsWith(bytes, [0xff, 0xf2])) {
    return "audio/mpeg";
  }
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) || startsWith(bytes, [0x50, 0x4b, 0x05, 0x06])) return "application/zip";
  if (ascii(bytes, 0, 4) === "Rar!") return "application/x-rar-compressed";
  if (startsWith(bytes, [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c])) return "application/x-7z-compressed";
  if (startsWith(bytes, [0x1f, 0x8b])) return "application/gzip";
  if (startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return "application/x-ole-storage";
  return null;
}

function isProbablyText(bytes: Uint8Array): boolean {
  const sample = bytes.subarray(0, 8192);
  for (const b of Array.from(sample)) {
    if (b === 0) return false;
  }
  return true;
}

/**
 * Makes a display name safe: no directories, no control characters, and no
 * bidi overrides — "invoice‮fdp.exe" renders as "invoiceexe.pdf" and is a
 * classic way to disguise a program as a document.
 */
export function sanitizeFileName(name: unknown): string {
  const raw = typeof name === "string" ? name : "";
  const base = raw.split(/[\\/]/).pop() ?? "";
  const cleaned = base
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[‎‏‪-‮⁦-⁩]/g, "")
    .replace(/["<>|:*?]/g, "_")
    .trim()
    .replace(/^\.+/, "");
  if (!cleaned) return "file";
  if (cleaned.length <= 150) return cleaned;
  const dot = cleaned.lastIndexOf(".");
  const ext = dot > 0 && cleaned.length - dot <= 10 ? cleaned.slice(dot) : "";
  return cleaned.slice(0, 150 - ext.length) + ext;
}

export function fileExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

function categorize(mime: string, ext: string): FileCategory {
  // Only images every browser can draw are "image"; HEIC/AVIF are downloads.
  if (mime.startsWith("image/")) return isInlineMime(mime) ? "image" : "other";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime === "application/pdf") return "pdf";
  if (DOCUMENT_EXTENSIONS.has(ext)) return "document";
  if (ARCHIVE_TYPES.has(mime)) return "archive";
  return "other";
}

export function inspectUploadedFile(input: { name: unknown; bytes: Uint8Array }): InspectedFile {
  const { bytes } = input;
  if (bytes.length === 0) return { ok: false, reason: "empty" };
  if (bytes.length > MAX_FILE_BYTES) return { ok: false, reason: "too_large" };

  const safeName = sanitizeFileName(input.name);
  const ext = fileExtension(safeName);

  // Every dotted part is checked, so "report.exe.pdf" can't sneak a blocked
  // extension past a reader who only looks at the end.
  const parts = safeName.toLowerCase().split(".").slice(1);
  if (parts.some((p) => BLOCKED_EXTENSIONS.has(p))) return { ok: false, reason: "blocked_type" };
  if (looksExecutable(bytes)) return { ok: false, reason: "executable" };

  const sniffed = sniffMimeType(bytes);
  const expected = EXTENSION_EXPECTS[ext];
  if (expected && (!sniffed || !expected.includes(sniffed))) return { ok: false, reason: "type_mismatch" };

  // Office documents that hide macros are blocked by extension above; a .doc
  // (OLE) is allowed but only ever downloaded, never rendered.
  const mimeType = sniffed ?? (isProbablyText(bytes) ? "text/plain" : "application/octet-stream");
  const category = categorize(mimeType, ext);
  const inline = isInlineMime(mimeType);

  return { ok: true, safeName, mimeType, category, inline };
}

/** Formats the attachment route may serve inline, keyed by detected type. */
export function isInlineMime(mime: string): boolean {
  return (
    ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"].includes(mime) ||
    mime.startsWith("video/") ||
    mime.startsWith("audio/")
  );
}
