"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSite } from "./site";
import { beatEnv, stop } from "@/lib/audio";
import { bpmOf, fmtT } from "@/lib/format";

const NAV = [
  ["/events", "Events"],
  ["/talent", "Talent"],
  ["/gallery", "Gallery"],
  ["/shop", "Shop"],
  ["/contact", "Contact"],
] as const;

const section = (path: string) => "/" + (path.split("/")[1] ?? "");

/** Ticks once a second; the value is only used to re-render clocks. */
export function useTick() {
  const [, set] = useState(0);
  useEffect(() => {
    const t = setInterval(() => set((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
}

function Clock() {
  const { city } = useSite();
  const [now, setNow] = useState<string | null>(null);
  useEffect(() => {
    if (!city) return;
    const f = () => setNow(`${city.name} ${fmtT(city.timezone, true)}`);
    f();
    const t = setInterval(f, 1000);
    return () => clearInterval(t);
  }, [city]);
  return (
    <span className="clock">
      <i></i>
      <span>{now ?? `${city?.name ?? ""} --:--:--`}</span>
    </span>
  );
}

function CitySwitch() {
  const { cities, slug, switchCity, wipe } = useSite();
  const seg = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLSpanElement>(null);
  // The button lights up straight away; the data swaps under the wipe.
  const shown = wipe?.to.slug ?? slug;
  useLayoutEffect(() => {
    const move = () => {
      const on = seg.current?.querySelector<HTMLElement>("button.on"),
        k = knob.current;
      if (!on || !k) return;
      k.style.width = on.offsetWidth + "px";
      k.style.transform = `translateX(${on.offsetLeft - 3}px)`;
    };
    move();
    addEventListener("resize", move);
    document.fonts?.ready.then(move);
    return () => removeEventListener("resize", move);
  }, [shown, cities]);
  return (
    <div className="city" ref={seg}>
      <span className="knob" ref={knob}></span>
      {cities.map((c) => (
        <button key={c.slug} className={c.slug === shown ? "on" : ""} onClick={() => switchCity(c.slug)}>
          {c.name}
        </button>
      ))}
    </div>
  );
}

export function Header() {
  const { view } = useSite();
  const on = section(view);
  return (
    <header>
      <div className="wrap bar">
        <Link className="brand" href="/">
          <span className="m">HOY</span>
          <span className="w">House of Young</span>
        </Link>
        <nav className="top">
          {NAV.map(([href, label]) => (
            <Link key={href} href={href} className={on === href ? "on" : ""}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="hr">
          <Clock />
          <CitySwitch />
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  const { global, cities } = useSite();
  const names = cities.length ? cities.map((c) => c.name).join(" · ") : "Valencia · Lagos";
  return (
    <footer>
      <div className="wrap">
        <span>
          © {new Date().getFullYear()} House of Young · {names}
        </span>
        <span>
          <Link href="/privacy">Privacy</Link> · <Link href="/legal">Legal notice</Link> · <Link href="/terms">Terms</Link>
        </span>
        {global.site?.show_powered_by && <span>Powered by SME Analytica</span>}
      </div>
    </footer>
  );
}

const TABS = [
  ["/", "Now", <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="2.5" /></>],
  ["/events", "Events", <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></>],
  ["/talent", "Talent", <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M6 11a6 6 0 0 0 12 0M12 17v4" /></>],
  ["/gallery", "Gallery", <><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="M21 16l-5-5-8 8" /></>],
  ["/contact", "Contact", <><path d="M4 6h16v10H8l-4 4z" /></>],
] as const;

/**
 * Mobile dock. The now-playing pill is positioned from the dock (bottom: 100% + 12px), so it
 * always sits above the tab bar, never behind it. Keep .np inside .dock.
 */
export function Dock() {
  const { view, playing, records, cur } = useSite();
  const on = section(view);
  const e = records[cur];
  const eq = useRef<HTMLSpanElement>(null);
  // The pill's eq bars follow the beat on every page (the hero's loop only runs on Home).
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const f = (now: number) => {
      const env = beatEnv(now, 104);
      eq.current?.querySelectorAll<HTMLElement>("i").forEach((b, i) => {
        b.style.height = Math.max(0.15, Math.min(1, 0.25 + env * (0.5 + 0.5 * Math.sin(now / 90 + i * 1.7)))) * 100 + "%";
      });
      raf = requestAnimationFrame(f);
    };
    raf = requestAnimationFrame(f);
    return () => cancelAnimationFrame(raf);
  }, [playing]);
  return (
    <div className="dock">
      <div className={`np${playing ? " on" : ""}`}>
        <span className="vin"></span>
        <span className="eq" ref={eq}>
          <i></i>
          <i></i>
          <i></i>
          <i></i>
        </span>
        <span>{e ? `${e.title} · ${bpmOf(e)} BPM` : ""}</span>
        <button aria-label="Stop" onClick={() => stop()}>
          ■
        </button>
      </div>
      <nav className="tabs">
        {TABS.map(([href, label, icon]) => (
          <Link key={href} href={href} className={on === href ? "on" : ""}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              {icon}
            </svg>
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
