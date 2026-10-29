"use client";

// Site state: the selected city and its data, the city wipe, detail sheets and the
// now-playing record. Replaces the prototype's globals (city, cur, D) and render().

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { loadCity } from "@/lib/api";
import { grooves as groovesOf, subscribe, A, type Groove } from "@/lib/audio";
import type { City, CityBundle, EventItem, Global, Track } from "@/lib/types";
import { COVER, FADE, Shuffle, warmPrints, warmPrintsSoon } from "./shuffle";

/** One random seed per page load: HOY Radio's running order and variations for this visit. */
let visitSeed = 0;
const getVisit = () => (visitSeed ||= 1 + Math.floor(Math.random() * 2 ** 31));
const noSub = () => () => {};
const useVisit = () => useSyncExternalStore(noSub, getVisit, () => 0);

/** `taste`: open an event sheet on the crowd taste step (after a Buy tickets click). */
export type SheetState = { type: "event" | "talent"; slug: string; pushed: boolean; base: string; taste?: boolean } | null;

type Ctx = {
  global: Global;
  cities: City[];
  slug: string;
  city: City | null;
  bundle: CityBundle | null;
  /** Every city loaded so far (the others are warmed 2.5s after first paint). */
  bundles: Record<string, CityBundle>;
  /** Records on the turntable: featured, falling back to upcoming. */
  records: EventItem[];
  /** The groove for each record, from its city's sound, varied for this visit. */
  grooves: Groove[];
  /** This visit's seed (0 until hydrated). */
  visit: number;
  cur: number;
  setCur: (n: number) => void;
  playing: boolean;
  /** The uploaded track HOY Radio is playing, or null for the generated groove. */
  onAir: Track | null;
  /** A city button was hovered or focused: load its data and a few prints for the switch. */
  prime: (to: string) => void;
  switchCity: (to: string) => void;
  wipe: { to: City; phase: "in" | "out" } | null;
  sheet: SheetState;
  openSheet: (type: "event" | "talent", slug: string, opts?: { taste?: boolean }) => void;
  /** Direct load of /events/:slug or /talent/:slug: the page underneath is the list. */
  adoptSheet: (type: "event" | "talent", slug: string) => void;
  closeSheet: () => void;
  /** Route underneath an open sheet, for the nav "on" state. */
  view: string;
  idle: React.RefObject<number>;
  bumpIdle: () => void;
};

const SiteCtx = createContext<Ctx | null>(null);
export const useSite = () => {
  const c = useContext(SiteCtx);
  if (!c) throw new Error("useSite outside SiteProvider");
  return c;
};

const COOKIE = "hoy_city";
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export function SiteProvider({
  global,
  initial,
  children,
}: {
  global: Global;
  initial: CityBundle | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const cities = global.cities;
  const [slug, setSlug] = useState(initial?.city ?? cities[0]?.slug ?? "");
  const cache = useRef(new Map<string, Promise<CityBundle>>());
  const [bundles, setBundles] = useState<Record<string, CityBundle>>(initial ? { [initial.city]: initial } : {});
  const [cur, setCurState] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [wipe, setWipe] = useState<Ctx["wipe"]>(null);
  const switching = useRef(false);
  const idle = useRef(0);
  const [sheet, setSheet] = useState<SheetState>(null);

  const fetchCity = useCallback((s: string) => {
    let p = cache.current.get(s);
    if (!p) {
      p = loadCity(s).then((b) => {
        setBundles((m) => ({ ...m, [s]: b }));
        return b;
      });
      p.catch(() => cache.current.delete(s));
      cache.current.set(s, p);
    }
    return p;
  }, []);

  const prime = useCallback(
    (to: string) => {
      if (to !== slug) fetchCity(to).then(warmPrints, () => {});
    },
    [slug, fetchCity],
  );

  useEffect(() => {
    if (initial) cache.current.set(initial.city, Promise.resolve(initial));
    if (slug && !bundles[slug]) fetchCity(slug);
    // Warm the other cities (and a few prints per city) after first paint so a switch never waits.
    const t = setTimeout(() => cities.forEach((c) => fetchCity(c.slug).then(warmPrintsSoon, () => {})), 2500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [onAir, setOnAir] = useState<Track | null>(null);
  useEffect(
    () =>
      subscribe((on) => {
        setPlaying(on);
        setOnAir(on ? A.track : null);
      }),
    [],
  );
  const visit = useVisit();

  const bundle = bundles[slug] ?? null;
  const city = cities.find((c) => c.slug === slug) ?? null;
  const records = useMemo(() => (bundle ? (bundle.featured.length ? bundle.featured : bundle.events) : []), [bundle]);
  const grooves = useMemo(() => groovesOf(records, visit), [records, visit]);

  const setCur = useCallback((n: number) => {
    idle.current = 0;
    setCurState(n);
  }, []);

  const switchCity = useCallback(
    (to: string) => {
      if (to === slug || switching.current) return;
      const target = cities.find((c) => c.slug === to);
      if (!target) return;
      document.cookie = `${COOKIE}=${to}; path=/; max-age=31536000; samesite=lax`;
      const ready = fetchCity(to);
      const apply = () => {
        setSlug(to);
        setCurState(0);
      };
      if (!Element.prototype.animate) {
        ready.finally(apply);
        return;
      }
      switching.current = true;
      setWipe({ to: target, phase: "in" });
      // Data swaps once the cover is up; if the data is late, the cover holds.
      const at = new Promise((r) => setTimeout(r, reduced() ? FADE : COVER));
      Promise.all([at, ready.catch(() => null)]).then(() => {
        apply();
        setWipe({ to: target, phase: "out" });
      });
    },
    [slug, cities, fetchCity],
  );

  const wipeDone = useCallback(() => {
    setWipe(null);
    switching.current = false;
  }, []);

  const openSheet = useCallback(
    (type: "event" | "talent", s: string, opts?: { taste?: boolean }) => {
      const url = `/${type === "event" ? "events" : "talent"}/${s}`;
      // From inside a sheet (e.g. a line-up name in an event sheet), swap the sheet in place so
      // closing goes straight back to the page underneath.
      if (sheet) {
        window.history.replaceState(null, "", url);
        setSheet({ ...sheet, type, slug: s, taste: opts?.taste });
        return;
      }
      window.history.pushState(null, "", url);
      setSheet({ type, slug: s, pushed: true, base: pathname, taste: opts?.taste });
    },
    [pathname, sheet],
  );

  const adoptSheet = useCallback((type: "event" | "talent", s: string) => {
    setSheet({ type, slug: s, pushed: false, base: type === "event" ? "/events" : "/talent" });
  }, []);

  const closeSheet = useCallback(() => {
    if (!sheet) return;
    if (sheet.pushed) {
      setSheet(null);
      window.history.back();
    } else {
      setSheet(null);
      router.replace(sheet.base, { scroll: false });
    }
  }, [sheet, router]);

  // Back button while a pushed sheet is open closes it.
  useEffect(() => {
    const onPop = () => setSheet((s) => (s?.pushed ? null : s));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // A real navigation (nav link, tab) closes any sheet.
  const lastPath = useRef(pathname);
  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    setSheet((s) => {
      if (!s) return s;
      const url = `/${s.type === "event" ? "events" : "talent"}/${s.slug}`;
      return pathname === url ? s : null;
    });
  }, [pathname]);

  const bumpIdle = useCallback(() => {
    idle.current = 0;
  }, []);
  useEffect(() => {
    const reset = () => (idle.current = 0);
    const opts = { passive: true } as const;
    ["click", "keydown", "wheel", "pointerdown"].forEach((t) => window.addEventListener(t, reset, opts));
    return () => ["click", "keydown", "wheel", "pointerdown"].forEach((t) => window.removeEventListener(t, reset));
  }, []);

  const view = sheet ? sheet.base : pathname;

  const value: Ctx = {
    global,
    cities,
    slug,
    city,
    bundle,
    bundles,
    records,
    grooves,
    visit,
    cur: records.length ? Math.min(cur, records.length - 1) : 0,
    setCur,
    playing,
    onAir,
    prime,
    switchCity,
    wipe,
    sheet,
    openSheet,
    adoptSheet,
    closeSheet,
    view,
    idle,
    bumpIdle,
  };
  return (
    <SiteCtx.Provider value={value}>
      {children}
      <Shuffle wipe={wipe} bundles={bundles} done={wipeDone} />
    </SiteCtx.Provider>
  );
}

export const isPlaying = () => A.on;
