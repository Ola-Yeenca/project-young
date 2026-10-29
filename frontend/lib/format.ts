import type { City, EventItem } from "./types";

export const AUTO = 9000;
export const pad = (n: number) => String(n).padStart(2, "0");

/** Prototype money(): 0 → "Free", else symbol + en-GB grouping. */
export const money = (cur: string, p: number) => (p === 0 ? "Free" : cur + Math.round(p).toLocaleString("en-GB"));

/** Ticket price as a number; null when the price is not announced. */
export const priceOf = (e: EventItem): number | null =>
  e.is_free ? 0 : e.price_from === null || e.price_from === "" ? null : Number(e.price_from);

/** Default to a configured external ticket page; retained simulation requires explicit mode. */
export const purchaseUrl = (e: EventItem): string => {
  if (e.ticketing_mode === "simulation") return e.checkout_url?.startsWith("/tickets/") ? e.checkout_url : "";
  if (!e.ticket_url) return "";
  try {
    const u = new URL(e.ticket_url);
    const host = u.hostname.toLowerCase().replace(/\.$/, "");
    const publicHost = host.includes(".") && !/^[\d.]+$/.test(host) && host.split(".").every((label) =>
      /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label),
    );
    const reserved = /(^|\.)(localhost|localdomain|local|internal|lan|test|invalid|example)$/.test(host)
      || /(^|\.)example\.(com|org|net|test)$/.test(host);
    return u.protocol === "https:" && !u.username && !u.password && publicHost && !reserved ? u.href : "";
  } catch {
    return "";
  }
};

export const KINDS: Record<string, string> = {
  club: "Club",
  live: "Live",
  day: "Day",
  festival: "Festival",
  talk: "Talk",
  private: "Private",
};
export const kindLabel = (k: string) => KINDS[k] ?? k.charAt(0).toUpperCase() + k.slice(1);

/** Prototype style switch: amapiano → piano pattern, everything else → afro. */
export const soldOf = (e: EventItem) => (e.sold_out ? 100 : Math.max(0, Math.min(100, e.sold_percent || 0)));

/** row() tag: Sold out at 100, Selling fast from 70 on upcoming rows. */
export const tagOf = (e: EventItem, past: boolean) => {
  const sold = soldOf(e);
  return sold >= 100 ? "Sold out" : !past && sold >= 70 ? "Selling fast" : "";
};

/** Stable seed from a string, for the field() fallback art. */
export const seedOf = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 997;
};

export const fmtT = (tz: string, sec: boolean) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", second: sec ? "2-digit" : undefined }).format(new Date());

/** The prototype computed distance from lat/lng; the API has none, so known cities live here. */
export const COORDS: Record<string, [number, number]> = {
  valencia: [39.4699, -0.3763],
  lagos: [6.5244, 3.3792],
};

export const distanceKm = (a: string, b: string) => {
  const A = COORDS[a],
    B = COORDS[b];
  if (!A || !B) return null;
  const R = 6371,
    rad = (x: number) => (x * Math.PI) / 180,
    dl = rad(B[0] - A[0]),
    dn = rad(B[1] - A[1]);
  const h = Math.sin(dl / 2) ** 2 + Math.cos(rad(A[0])) * Math.cos(rad(B[0])) * Math.sin(dn / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
};

export const hoursApart = (tzA: string, tzB: string) => {
  const now = new Date();
  const off = (tz: string) => new Date(now.toLocaleString("en-US", { timeZone: tz })).getTime();
  return Math.round((off(tzA) - off(tzB)) / 36e5);
};

export const shipLine = (c: City) => `${c.currency} · ships from ${c.name}`;

export const isHttp = (u: string | null | undefined) => !!u && /^https?:\/\//i.test(u);

export const RM = () => typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
