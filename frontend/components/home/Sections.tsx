"use client";

// Home below the hero (prototype L453–466): marquee, the two cities, the calendar, the line-up
// band and the "From the floor" strip.

import Link from "next/link";
import { Fragment, useEffect, useRef, useState } from "react";
import { useSite } from "../site";
import { Peek, peekOf } from "../ui";
import { RowsSkeleton } from "../skeleton";
import { Frames, IdxHead, interleave, NoDates, Row } from "./sections/shared";
import { distanceKm, fmtT, hoursApart, RM, seedOf } from "@/lib/format";
import type { City } from "@/lib/types";

type CSS = React.CSSProperties;

/* ---------------- marquee: speeds up and flips with scroll ---------------- */

// Module-level like the prototype's M, so the position survives a city switch.
const M = { x: 0, dir: -1, sv: 0, lastY: 0 };

export function Marquee() {
  const { bundle, city } = useSite();
  const tr = useRef<HTMLDivElement>(null);

  useEffect(() => {
    M.lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      M.sv = y - M.lastY;
      M.lastY = y;
      if (Math.abs(M.sv) > 1) M.dir = M.sv > 0 ? -1 : 1;
    };
    const rm = RM();
    let raf = 0,
      last = 0;
    const frame = (now: number) => {
      const dt = Math.min(50, now - (last || now));
      last = now;
      const t = tr.current;
      if (t && t.offsetParent) {
        if (rm) t.style.transform = "none";
        else {
          const speed = (0.045 + Math.min(1.4, Math.abs(M.sv) * 0.02)) * dt;
          M.sv *= 0.9;
          M.x += M.dir * speed;
          const w = t.scrollWidth / 2;
          if (w) {
            if (M.x < -w) M.x += w;
            if (M.x > 0) M.x -= w;
          }
          t.style.transform = `translateX(${M.x}px)`;
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const one = (n: number) => (
    <Fragment key={n}>
      {(bundle?.events ?? []).map((e) => (
        <Fragment key={e.slug}>
          <span className="f">{e.title}</span>
          <span className="s">✦</span>
          <span>{e.local.date.slice(4)}</span>
          <span className="s">✦</span>
        </Fragment>
      ))}
      <span className="f">{city?.name}</span>
      <span className="s">✦</span>
    </Fragment>
  );
  return (
    <div className="mq" id="mq" aria-hidden="true">
      <div className="tr" ref={tr}>
        {one(0)}
        {one(1)}
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

const P = "M20 20 Q 95 25 100 100",
  Pr = "M100 100 Q 95 25 20 20";

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
      <CityCard c={a} on={a.slug === slug} now={now} />
      {b && (
        <>
          <div className="link">
            <svg viewBox="0 0 120 120">
              <path d={P} fill="none" stroke="var(--line-2)" strokeDasharray="3 4" />
              <circle cx="20" cy="20" r="5" fill={slug === a.slug ? "var(--gold)" : "var(--ink-2)"} />
              <circle cx="100" cy="100" r="5" fill={slug === b.slug ? "var(--gold)" : "var(--ink-2)"} />
              {mounted && !RM() && (
                <circle r="3.2" fill="var(--gold)">
                  <animateMotion dur="3.6s" repeatCount="indefinite" path={slug === a.slug ? Pr : P} keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines=".6 0 .4 1" />
                </circle>
              )}
            </svg>
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
        <p>Artists, DJs, hosts and crews represented by House of Young. Pick a name to see the profile and send a booking enquiry.</p>
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
