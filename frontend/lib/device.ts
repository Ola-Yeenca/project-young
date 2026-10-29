// Opt-in device recognition for gallery stats. Nothing about the device is read until the
// visitor agrees (EU ePrivacy rules treat fingerprinting like cookies), and they can turn it
// off again. Only a SHA-256 of the signals leaves the browser.

import { useSyncExternalStore } from "react";

export type Choice = "yes" | "no" | null;

const KEY = "hoy-device";
const subs = new Set<() => void>();
let cached: Promise<string> | null = null;

function read(): Choice {
  try {
    const v = localStorage.getItem(KEY);
    return v === "yes" || v === "no" ? v : null;
  } catch {
    return null;
  }
}

export function choose(c: "yes" | "no") {
  try {
    localStorage.setItem(KEY, c);
  } catch {}
  if (c === "no") cached = null;
  subs.forEach((f) => f());
}

export function useDeviceChoice(): Choice | "unknown" {
  return useSyncExternalStore(
    (fn) => {
      subs.add(fn);
      window.addEventListener("storage", fn);
      return () => {
        subs.delete(fn);
        window.removeEventListener("storage", fn);
      };
    },
    read,
    () => "unknown",
  );
}

function canvasSig() {
  try {
    const cv = document.createElement("canvas");
    cv.width = 220;
    cv.height = 40;
    const g = cv.getContext("2d")!;
    g.textBaseline = "top";
    g.font = "16px Arial";
    g.fillStyle = "#c9a043";
    g.fillRect(0, 0, 220, 40);
    g.fillStyle = "#111";
    g.fillText("House of Young ✦ 2022", 4, 10);
    return cv.toDataURL();
  } catch {
    return "";
  }
}

async function compute() {
  const n = navigator as Navigator & { deviceMemory?: number };
  const signals = [
    n.userAgent,
    n.language,
    (n.languages ?? []).join(","),
    n.platform,
    n.hardwareConcurrency,
    n.deviceMemory ?? "",
    n.maxTouchPoints,
    `${screen.width}x${screen.height}x${screen.colorDepth}`,
    devicePixelRatio,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    canvasSig(),
  ];
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(signals.join("|")));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** The device key, or "" without consent. */
export function deviceId(): Promise<string> {
  if (read() !== "yes" || !globalThis.crypto?.subtle) return Promise.resolve("");
  return (cached ??= compute().catch(() => ""));
}
