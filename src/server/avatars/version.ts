import crypto from "crypto";

/** Short public version tag: changes with every new photo, reveals nothing. */
export function avatarVersion(key: string | null | undefined): string | null {
  return key ? crypto.createHash("sha256").update(key).digest("hex").slice(0, 10) : null;
}
