// Crowd taste: what guests want the DJs to play. Answers are anonymous; the browser keeps a random
// id (only its keyed hash reaches the database) so sending again updates the same answer.

import { useMemo, useSyncExternalStore } from "react";
import { base } from "./api";
import { purchaseUrl } from "./format";
import type { EventItem } from "./types";

export type TasteOption = { slug: string; name: string };
export type TasteSummary = {
  open: boolean;
  closes_at: string;
  options: TasteOption[];
  total: number;
  /** Share of answers that picked each genre, most picked first. Free text is never public. */
  genres: (TasteOption & { percent: number })[];
};
export type TasteSource = "ticket" | "qr";
export type TasteAnswer = { genres: string[]; artist: string; song: string };
export type TasteSent = { ok: true; summary: TasteSummary } | { ok: false; errors: Record<string, string> };

export const MAX_GENRES = 3;
const ID = "hoy-taste-id";
const ASKED = "hoy-taste-asked";
const MINE = "hoy-taste-mine";

const raw = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const parse = <T>(text: string | null, fallback: T): T => {
  try {
    return (JSON.parse(text ?? "null") as T) ?? fallback;
  } catch {
    return fallback;
  }
};
const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {}
};

function answerId(): string {
  const id = raw(ID) ?? "";
  if (/^[A-Za-z0-9_-]{16,64}$/.test(id)) return id;
  const fresh = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
  write(ID, fresh);
  return fresh;
}

/** True once the after-tickets step has been shown for this event in this browser. */
export const asked = (slug: string) => parse<string[]>(raw(ASKED), []).includes(slug);
export const markAsked = (slug: string) =>
  write(ASKED, JSON.stringify([slug, ...parse<string[]>(raw(ASKED), []).filter((s) => s !== slug)].slice(0, 50)));

/** Whether a Buy tickets click should turn our tab into the taste step. Simulated checkout stays in this tab. */
export const asksAfterBuying = (e: EventItem) => !!purchaseUrl(e) && e.ticketing_mode !== "simulation" && !e.is_cancelled && !asked(e.slug);

const subs = new Set<() => void>();
const subscribe = (fn: () => void) => {
  subs.add(fn);
  window.addEventListener("storage", fn);
  return () => {
    subs.delete(fn);
    window.removeEventListener("storage", fn);
  };
};

/** This browser's last answer for an event, kept only on the device to prefill the form. Undefined until hydrated. */
export function useMine(slug: string): TasteAnswer | null | undefined {
  const all = useSyncExternalStore(subscribe, () => raw(MINE) ?? "", () => null);
  return useMemo(() => (all === null ? undefined : (parse<Record<string, TasteAnswer>>(all, {})[slug] ?? null)), [all, slug]);
}

function remember(slug: string, a: TasteAnswer) {
  const all = parse<Record<string, TasteAnswer>>(raw(MINE), {});
  delete all[slug];
  write(MINE, JSON.stringify(Object.fromEntries([[slug, a], ...Object.entries(all)].slice(0, 20))));
  subs.forEach((f) => f());
}

const url = (slug: string) => `${base()}/events/${encodeURIComponent(slug)}/taste/`;

/** DRF nests list errors per item ({"genres": {"0": [...]}}); show the first message. */
const first = (v: unknown): string => (Array.isArray(v) ? first(v[0]) : v && typeof v === "object" ? first(Object.values(v)[0]) : String(v));

export async function getTaste(slug: string): Promise<TasteSummary> {
  const res = await fetch(url(slug), { headers: { Accept: "application/json" }, cache: "no-store" });
  if (!res.ok) throw new Error(`GET taste failed (${res.status})`);
  return res.json();
}

export async function sendTaste(slug: string, source: TasteSource, answer: TasteAnswer, website: string): Promise<TasteSent> {
  try {
    const res = await fetch(url(slug), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ ...answer, source, website, token: answerId() }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      remember(slug, answer);
      return { ok: true, summary: data as TasteSummary };
    }
    const errors: Record<string, string> = {};
    if (res.status === 400 && data && typeof data === "object") {
      for (const [k, v] of Object.entries(data)) errors[k === "non_field_errors" || k === "detail" ? "__all__" : k] = first(v);
    } else errors.__all__ = res.status === 429 ? "We're getting a lot of answers right now. Try again in a minute." : "Something went wrong. Please try again.";
    return { ok: false, errors };
  } catch {
    return { ok: false, errors: { __all__: "Something went wrong. Please try again." } };
  }
}
