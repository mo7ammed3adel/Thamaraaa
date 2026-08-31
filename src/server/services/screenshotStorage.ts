import { promises as fs } from "fs";
import path from "path";
import { isSafeStorageKey } from "@/lib/deviceMonitoring";

/**
 * On-disk screenshot storage.
 *
 * The root is deliberately outside the Next.js public/ tree, so an image is
 * never served as a static asset: every read goes through an authorized route
 * that checks the caller is a super admin. The path is configurable so the
 * Docker deployment can mount a dedicated volume for it.
 */
const STORAGE_ROOT =
  process.env.SCREENSHOT_STORAGE_DIR || path.join(process.cwd(), ".screenshots");

/** Resolves a storage key to an absolute path, refusing anything unexpected.
 * The key format is validated and the result is confined to STORAGE_ROOT, so a
 * crafted key can never escape the directory (path traversal). */
function resolveSafe(storageKey: string): string {
  if (!isSafeStorageKey(storageKey)) {
    throw new Error("Unsafe storage key");
  }
  const target = path.resolve(STORAGE_ROOT, storageKey);
  const root = path.resolve(STORAGE_ROOT);
  if (target !== root && !target.startsWith(root + path.sep)) {
    throw new Error("Storage key escapes the storage root");
  }
  return target;
}

export async function saveScreenshotFile(storageKey: string, data: Buffer): Promise<void> {
  const target = resolveSafe(storageKey);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, data);
}

export async function readScreenshotFile(storageKey: string): Promise<Buffer> {
  return fs.readFile(resolveSafe(storageKey));
}

export async function deleteScreenshotFile(storageKey: string): Promise<void> {
  try {
    await fs.unlink(resolveSafe(storageKey));
  } catch (error) {
    // A missing file is fine — the row may already have outlived its file.
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
