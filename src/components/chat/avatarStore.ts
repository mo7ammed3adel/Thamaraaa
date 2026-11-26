"use client";

import { useSyncExternalStore } from "react";
import { listUserAvatars } from "@/client/api/chat";

/**
 * Which colleagues have a profile photo (id → version), shared by every
 * <Avatar> on the page: one small request, refreshed every few minutes and
 * right after you change your own photo.
 */
let versions: Record<string, string> = {};
let loaded = false;
let inflight: Promise<void> | null = null;
let lastLoad = 0;
const listeners = new Set<() => void>();
/** Fresh enough: someone else's new photo shows up within this long. */
const REFRESH_MS = 2 * 60 * 1000;
let timer: ReturnType<typeof setInterval> | null = null;

function emit() {
  listeners.forEach((l) => l());
}

export function refreshAvatars(): Promise<void> {
  inflight ??= listUserAvatars()
    .then((map) => {
      versions = map;
      loaded = true;
      lastLoad = Date.now();
      emit();
    })
    // A failure (signed out, impersonating) also counts as a load, so every
    // new <Avatar> doesn't retry; initials show until the next refresh.
    .catch(() => {
      lastLoad = Date.now();
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Updates one person locally (e.g. right after uploading), then re-syncs. */
export function setAvatarVersion(userId: string, version: string | null) {
  versions = { ...versions };
  if (version) versions[userId] = version;
  else delete versions[userId];
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if ((!loaded && Date.now() - lastLoad > 30_000) || Date.now() - lastLoad > REFRESH_MS) refreshAvatars();
  // While anything shows avatars, re-sync now and then (only in a visible tab).
  timer ??= setInterval(() => {
    if (typeof document !== "undefined" && !document.hidden) refreshAvatars();
  }, REFRESH_MS);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

export function useAvatarVersion(userId: string | undefined): string | null {
  return useSyncExternalStore(
    subscribe,
    () => (userId ? versions[userId] ?? null : null),
    () => null
  );
}
