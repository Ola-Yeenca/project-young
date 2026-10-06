import type { Album, City, CityBundle, EventItem, FAQ, Global, Product, Site, Talent } from "./types";

/**
 * The API base. On the server we call the Django API directly; in the browser we call our own
 * origin and next.config rewrites /api/v1/* to the API, so no CORS is needed.
 */
export const SERVER_API = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8017/api/v1").replace(/\/$/, "");
export const base = () => (typeof window === "undefined" ? SERVER_API : "/api/v1");

const API_ORIGIN = new URL(SERVER_API).origin;

/**
 * Media for canvas drawing (the record label reads pixels for its grain). URLs on the API's own
 * origin go through our /media rewrite, so the browser sees them as same-origin and needs no CORS.
 * Other origins (R2/CDN) are returned unchanged: those buckets need a CORS rule for the site.
 */
export const mediaSrc = (url: string | null | undefined) =>
  url && typeof window !== "undefined" && url.startsWith(API_ORIGIN + "/media/") ? url.slice(API_ORIGIN.length) : url ?? null;

type Page<T> = { results: T[]; next: string | null };

export async function get<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(base() + path, { headers: { Accept: "application/json" }, ...init });
  if (!res.ok) throw new Error(`GET ${path} failed (${res.status})`);
  return res.json() as Promise<T>;
}

/** Reads a list, following DRF page links. Unpaginated endpoints return a plain array. */
export async function list<T>(path: string): Promise<T[]> {
  const first = await get<T[] | Page<T>>(path);
  if (Array.isArray(first)) return first;
  let items = first.results;
  let next = first.next;
  while (next) {
    const u = new URL(next);
    const page = await get<Page<T>>(u.pathname.replace(/^.*\/api\/v1/, "") + u.search);
    items = items.concat(page.results);
    next = page.next;
  }
  return items;
}

const safe = async <T>(p: Promise<T>, fallback: T): Promise<T> => {
  try {
    return await p;
  } catch {
    return fallback;
  }
};

export async function loadGlobal(): Promise<Global> {
  const [cities, site, faqs] = await Promise.all([
    safe(list<City>("/cities/"), []),
    safe(get<Site>("/site/"), null),
    safe(list<FAQ>("/faqs/"), []),
  ]);
  return { cities, site, faqs };
}

export async function loadCity(city: string): Promise<CityBundle> {
  const q = `?city=${encodeURIComponent(city)}`;
  const [featured, events, past, talent, albums, products] = await Promise.all([
    safe(list<EventItem>(`/events/${q}&featured=1`), []),
    safe(list<EventItem>(`/events/${q}`), []),
    safe(list<EventItem>(`/events/${q}&when=past`), []),
    safe(list<Talent>(`/talent/${q}`), []),
    safe(list<Album>(`/gallery/${q}`), []),
    safe(list<Product>(`/products/${q}`), []),
  ]);
  const full = await Promise.all(albums.map((a) => safe(get<Album>(`/gallery/${a.slug}/`), { ...a, items: [] })));
  return { city, featured, events, past, talent, albums: full, products };
}

export type Sent = { ok: true; reference: string } | { ok: false; status: number; errors: Record<string, string> };

/** POSTs an enquiry. 400 → field errors, 429 → throttled, anything else → a general error. */
export async function post(path: string, body: Record<string, unknown>): Promise<Sent> {
  try {
    const res = await fetch(base() + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, reference: data.reference };
    const errors: Record<string, string> = {};
    if (res.status === 400 && data && typeof data === "object") {
      for (const [k, v] of Object.entries(data)) errors[k === "non_field_errors" || k === "detail" ? "__all__" : k] = Array.isArray(v) ? String(v[0]) : String(v);
    } else if (res.status === 429) {
      errors.__all__ = "Too many messages, try again later";
    } else {
      errors.__all__ = "Something went wrong. Please try again.";
    }
    return { ok: false, status: res.status, errors };
  } catch {
    return { ok: false, status: 0, errors: { __all__: "Something went wrong. Please try again." } };
  }
}
