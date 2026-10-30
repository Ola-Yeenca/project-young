"use client";

// Home below the hero (prototype L453–466): marquee, the two cities, the calendar, the line-up
// band and the "From the floor" strip.

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSite } from "../site";
import { Peek, peekOf } from "../ui";
import { RowsSkeleton } from "../skeleton";
import { Frames, IdxHead, interleave, NoDates, Row } from "./sections/shared";
import { COORDS, distanceKm, fmtT, hoursApart, RM, seedOf } from "@/lib/format";
import { GLOBE, GRID, LAND, LAND_RIM, onGlobe } from "@/lib/globe";
import type { City } from "@/lib/types";

type CSS = React.CSSProperties;

/* ---------------- marquee: the next nights, speeding up and flipping with scroll ---------------- */

// Module-level like the prototype's M, so the position survives a city switch.
const M = { x: 0, dir: -1, sv: 0, lastY: 0 };

/** Wraps x into (-p, 0], where the copies line up exactly with the first set. */
const wrap = (x: number, p: number) => -(((-x % p) + p) % p);

export function Marquee() {
  const { bundle, city, openSheet } = useSite();
  const box = useRef<HTMLDivElement>(null);
  const tr = useRef<HTMLDivElement>(null);
  const period = useRef(0);
  const hold = useRef(false);
  // Enough copies to cover twice the marquee's width; measured after the first paint-free layout.
  const [copies, setCopies] = useState(2);
  const nights = (bundle?.events ?? []).filter((e) => !e.is_cancelled).slice(0, 4);

  useLayoutEffect(() => {
    const b = box.current,
      t = tr.current;
    if (!b || !t) return;
    const measure = () => {
      const [first, second] = t.children;
      if (!first || !second) return;
      const p = second.getBoundingClientRect().left - first.getBoundingClientRect().left;
      if (p <= 0) return;
      period.current = p;
      const need = Math.max(2, Math.ceil((2 * b.clientWidth) / p) + 1);
      setCopies((c) => (c === need ? c : need));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(b);
    ro.observe(t.firstElementChild!);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (RM()) return;
    M.lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      M.sv = y - M.lastY;
      M.lastY = y;
      if (Math.abs(M.sv) > 1) M.dir = M.sv > 0 ? -1 : 1;
    };
    let raf = 0,
      last = 0;
    const frame = (now: number) => {
      const dt = Math.min(50, now - (last || now));
      last = now;
      const t = tr.current;
      if (t && t.offsetParent && !hold.current) {
        M.x += M.dir * (0.045 + Math.min(1.4, Math.abs(M.sv) * 0.02)) * dt;
        if (period.current) M.x = wrap(M.x, period.current);
        t.style.transform = `translateX(${M.x}px)`;
      }
      M.sv *= 0.9;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  /* Keyboard focus stops the strip with the focused night in view (the box itself never scrolls). */
  const onFocus = (ev: React.FocusEvent) => {
    hold.current = true;
    const b = box.current,
      t = tr.current,
      a = ev.target as HTMLElement;
    if (!b || !t || RM()) return;
    requestAnimationFrame(() => {
      b.scrollLeft = 0;
      const r = a.getBoundingClientRect(),
        br = b.getBoundingClientRect();
      if (r.left < br.left || r.right > br.right) M.x = Math.min(0, M.x + br.left + 20 - r.left);
      t.style.transform = `translateX(${M.x}px)`;
    });
  };
  const release = () => (hold.current = false);

  const set = (n: number) => {
    const copy = n > 0;
    if (!nights.length)
      return (
        <ul className={`set${copy ? " copy" : ""}`} key={n} aria-hidden="true">
          <li>
            <span className="f">{city?.name}</span>
            <span className="s">✦</span>
          </li>
        </ul>
      );
    return (
      <ul className={`set evs${copy ? " copy" : ""}`} key={n} aria-hidden={copy || undefined} aria-label={copy ? undefined : `Next in ${city?.name ?? "the city"}`}>
        {nights.map((e) => (
          <li key={e.slug}>
            <a
              className="ev"
              href={`/events/${e.slug}`}
              tabIndex={copy ? -1 : undefined}
              onClick={(ev) => {
                if (ev.metaKey || ev.ctrlKey || ev.shiftKey) return;
                ev.preventDefault();
                openSheet("event", e.slug);
              }}
            >
              <span className="o">{e.local.date}</span>
              <span className="o">·</span>
              <span className="f">{e.lineup[0]?.name || e.title}</span>
              <span className="o">· {e.venue.name}</span>
              {e.sold_out && <small>Sold out</small>}
            </a>
            <span className="s" aria-hidden="true">
              ✦
            </span>
          </li>
        ))}
      </ul>
    );
  };
  return (
    <div className="mq" id="mq" ref={box} onPointerEnter={() => (hold.current = true)} onPointerLeave={release} onFocus={onFocus} onBlur={release}>
      <div className="tr" ref={tr}>
        {Array.from({ length: copies }, (_, n) => set(n))}
      </div>
    </div>
  );
}

/* ---------------- two cities ---------------- */

/** Ticks every second; null until mounted so server and client markup agree ("--:--"). */
function useNow() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const f = () => setNow(Date.now());
    f();
    const t = setInterval(f, 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function CityCard({ c, on, now }: { c: City; on: boolean; now: number | null }) {
  const { bundles, switchCity } = useSite();
  const next = bundles[c.slug]?.events[0];
  const t = now === null ? null : fmtT(c.timezone, true);
  return (
    <div className={`cityc ${on ? "on" : ""}`} data-rv="" onClick={() => switchCity(c.slug)}>
      <div className="top">
        <h3>{c.name}</h3>
        <span className="t" data-tz={c.timezone}>
          {t ? (
            <>
              {t.slice(0, 5)}
              <b>:{t.slice(6, 8)}</b>
            </>
          ) : (
            "--:--"
          )}
        </span>
      </div>
      <span className="nx">
        Next: <b>{next ? next.title : "New dates soon"}</b>
        {next && <> · {next.local.date}</>}
      </span>
      <span className="mono">
        {c.ticket_provider} · {c.currency}
      </span>
    </div>
  );
}

type Pt = { x: number; y: number };
const f1 = (n: number) => Math.round(n * 10) / 10;
/** A shallow arc from p to q, bowed to the west (over the Atlantic for Valencia–Lagos). */
const arc = (p: Pt, q: Pt) => {
  const s = q.y >= p.y ? 1 : -1;
  return `M${p.x} ${p.y} Q ${f1((p.x + q.x) / 2 - s * (q.y - p.y) * 0.45)} ${f1((p.y + q.y) / 2 + s * (q.x - p.x) * 0.45)} ${q.x} ${q.y}`;
};
const at = (slug: string) => (COORDS[slug] ? onGlobe(COORDS[slug]) : null);

/** The two cities on a dotted globe, the route between them, and a dot travelling to the current one. */
function Route({ a, b, slug, mounted }: { a: City; b: City; slug: string; mounted: boolean }) {
  const pa = at(a.slug) ?? { x: 20, y: 20 },
    pb = at(b.slug) ?? { x: 100, y: 100 };
  const there = slug === a.slug ? arc(pb, pa) : arc(pa, pb);
  return (
    <svg viewBox="0 0 120 120" role="img" aria-label={`${a.name} and ${b.name} on a globe`}>
      <circle className="g-disc" cx={GLOBE.cx} cy={GLOBE.cy} r={GLOBE.edge} />
      <path className="g-grid" d={GRID} />
      <path className="g-land" d={LAND} />
      <path className="g-land rim" d={LAND_RIM} />
      <path className="g-route" d={arc(pa, pb)} />
      {[
        { c: a, p: pa },
        { c: b, p: pb },
      ].map(({ c, p }) => {
        const on = c.slug === slug;
        return (
          <g key={c.slug} className={on ? "on" : ""}>
            {on && <circle className="g-halo" cx={p.x} cy={p.y} r="6.5" />}
            <circle cx={p.x} cy={p.y} r="3" fill={on ? "var(--gold)" : "var(--ink-2)"} />
            <text x={p.x + 6.5} y={p.y + 2.2}>
              {c.name.toUpperCase()}
            </text>
          </g>
        );
      })}
      {mounted && !RM() && (
        <circle r="1.8" fill="var(--gold)">
          <animateMotion dur="3.6s" repeatCount="indefinite" path={there} keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines=".6 0 .4 1" />
        </circle>
      )}
    </svg>
  );
}

export function Cities() {
  const { cities, slug } = useSite();
  const now = useNow();
  const [a, b, ...rest] = cities;
  if (!a) return null;
  const mounted = now !== null;
  const km = b ? distanceKm(a.slug, b.slug) : null;
  const diff = b && mounted ? hoursApart(a.timezone, b.timezone) : null;
  return (
    <div className="cities" id="cities">
      {/* Keeps the heading outline in order (h1 hero → h3 city names); visually hidden. */}
      <h2 className="hp">Our cities</h2>
      <CityCard c={a} on={a.slug === slug} now={now} />
      {b && (
        <>
          <div className="link">
            <Route a={a} b={b} slug={slug} mounted={mounted} />
            <span className="mono" id="dist">
              {diff !== null && (
                <>
                  {km !== null && (
                    <>
                      {km.toLocaleString("en-GB")} km
                      <br />
                    </>
                  )}
                  {diff === 0 ? "same time" : Math.abs(diff) + "h apart"}
                </>
              )}
            </span>
          </div>
          <CityCard c={b} on={b.slug === slug} now={now} />
        </>
      )}
      {rest.map((c) => (
        <CityCard key={c.slug} c={c} on={c.slug === slug} now={now} />
      ))}
    </div>
  );
}

/* ---------------- the calendar ---------------- */

export function Calendar() {
  const { bundle } = useSite();
  return (
    <div className="idx" id="home-idx" data-peekwrap="">
      <IdxHead />
      {!bundle ? <RowsSkeleton n={4} /> : bundle.events.length ? bundle.events.map((e, i) => <Row key={e.slug} e={e} i={i} k={i} past={false} />) : <NoDates />}
      <Peek />
    </div>
  );
}

/* ---------------- line-up ---------------- */

const CATS = ["All", "DJs", "Live", "Hosts"];
const supOf = (g: string) => (g === "DJs" ? "DJ" : g === "Live" ? "LIVE" : "HOST");

/** Prototype lineup(c, home): the intro column and the names, inside .night .wrap. */
export function Lineup({ home }: { home: boolean }) {
  const { bundle, city, openSheet } = useSite();
  const [cat, setCat] = useState("All");
  const list = (bundle?.talent ?? []).filter((t) => cat === "All" || t.group === cat);
  return (
    <>
      <div className="intro" data-rv="">
        <span className="mono">
          {home ? "On the roster" : "Talent"} · {city?.name}
        </span>
        {home && (
          <h2 style={{ fontSize: "clamp(2rem,4cqw,2.9rem)" }}>
            Book the{" "}
            <span className="it" style={{ color: "var(--gold)" }}>
              people
            </span>{" "}
            who make the night.
          </h2>
        )}
        <p>House of Young represents these artists, DJs, hosts and crews. Pick a name to see their profile and send a booking enquiry.</p>
        <div className="chips">
          {CATS.map((k) => (
            <button key={k} className={k === cat ? "on" : ""} onClick={() => setCat(k)}>
              {k}
            </button>
          ))}
        </div>
        {home && (
          <Link className="btn sm" href="/talent" style={{ justifySelf: "start", borderColor: "var(--night-line)", color: "var(--night-fg)" }}>
            Full roster <span className="ar">→</span>
          </Link>
        )}
      </div>
      <div className="names" data-peekwrap="">
        {list.map((t, k) => (
          <button
            key={`${cat}-${t.slug}`}
            data-rv=""
            style={{ "--d": `${k * 80}ms` } as CSS}
            data-peek={peekOf(t.photo, seedOf(t.slug))}
            onClick={() => openSheet("talent", t.slug)}
          >
            <span className="nm">
              {[...t.name].map((ch, i) => (
                <span key={i} className="ch" style={{ "--i": i } as CSS}>
                  {ch}
                </span>
              ))}
            </span>
            <sup>{supOf(t.group)}</sup>
          </button>
        ))}
        <Peek />
      </div>
    </>
  );
}

/* ---------------- from the floor ---------------- */

export function FloorStrip() {
  const { bundle } = useSite();
  const shots = interleave(bundle?.albums ?? []).slice(0, 8);
  return (
    <div className="strip" id="home-strip" data-drift="">
      <Frames shots={shots} prefix="home" />
    </div>
  );
}
