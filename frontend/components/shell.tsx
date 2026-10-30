"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSite } from "./site";
import { beatEnv, stop } from "@/lib/audio";
import { fmtT, isHttp } from "@/lib/format";
import mark from "@/public/hoy-mark.jpg";

const NAV = [
  ["/events", "Events"],
  ["/talent", "Talent"],
  ["/gallery", "Gallery"],
  ["/shop", "Shop"],
  ["/business", "Business"],
  ["/contact", "Contact"],
] as const;

export const MOTTO = "The Vision Is Ours.";

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
  const { cities, slug, prime, switchCity, wipe } = useSite();
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
        <button
          key={c.slug}
          className={c.slug === shown ? "on" : ""}
          onPointerEnter={() => prime(c.slug)}
          onFocus={() => prime(c.slug)}
          onClick={() => switchCity(c.slug)}
        >
          {c.name}
        </button>
      ))}
    </div>
  );
}

export function Header() {
  const { view, global } = useSite();
  const on = section(view);
  const business = !!global.site?.business_enabled;
  return (
    <header>
      <div className="wrap bar">
        <Link className="brand" href="/" aria-label="House of Young, home">
          <span className="m">
            <Image src={mark} alt="" width={34} height={34} priority />
          </span>
          <span className="w">House of Young</span>
        </Link>
        <nav className="top">
          {NAV.filter(([href]) => business || href !== "/business").map(([href, label]) => (
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

const SOCIAL = [
  ["instagram_url", "Instagram", <><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.2" cy="6.8" r=".6" /></>],
  ["tiktok_url", "TikTok", <><path d="M14 3.5v11a3.5 3.5 0 1 1-3.5-3.5M14 3.5c.4 2.6 2.1 4.3 5 4.6" /></>],
  ["youtube_url", "YouTube", <><rect x="2.5" y="5.5" width="19" height="13" rx="4" /><path d="M10 9.2v5.6l4.8-2.8z" /></>],
] as const;

export function Footer() {
  const { global } = useSite();
  const site = global.site;
  const business = !!site?.business_enabled;
  const social = SOCIAL.filter(([k]) => isHttp(site?.[k]));
  return (
    <footer>
      <div className="wrap ft">
        <Link className="ft-brand" href="/" aria-label="House of Young, home">
          <Image src={mark} alt="" width={44} height={44} />
          <span>
            <b>House of Young</b>
            <em className="it">{site?.tagline || MOTTO}</em>
          </span>
        </Link>
        {social.length > 0 && (
          <div className="ft-social">
            {social.map(([k, label, icon]) => (
              <a key={k} href={site?.[k]} target="_blank" rel="noopener noreferrer" aria-label={`House of Young on ${label}`}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  {icon}
                </svg>
              </a>
            ))}
          </div>
        )}
        <nav className="ft-nav" aria-label="Footer">
          {[...NAV.filter(([href]) => business || href !== "/business"), ["/about", "About"] as const].map(([href, label]) => (
            <Link key={href} href={href}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="ft-base">
          <span>© {new Date().getFullYear()} House of Young</span>
          <span className="ft-legal">
            <Link href="/privacy">Privacy</Link>
            <Link href="/legal">Legal notice</Link>
            <Link href="/terms">Terms</Link>
          </span>
          {site?.show_powered_by && <span className="ft-by">Powered by SME Analytica</span>}
        </div>
      </div>
    </footer>
  );
}

const TABS = [
  ["/events", "Events", <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></>],
  ["/talent", "Talent", <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M6 11a6 6 0 0 0 12 0M12 17v4" /></>],
  ["/gallery", "Gallery", <><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="M21 16l-5-5-8 8" /></>],
  ["/shop", "Shop", <><path d="M5 8h14l-1.2 12H6.2z" /><path d="M9 8a3 3 0 0 1 6 0" /></>],
  ["/business", "Business", <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5h6v2M3 13h18" /></>],
  ["/contact", "Contact", <><path d="M4 6h16v10H8l-4 4z" /></>],
] as const;

const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Mobile dock: a floating tab bar. The dock itself has no height; the bar and the now-playing pill
 * hang from its bottom edge (--dock-h clears the bar), and the footer pads by the same amount.
 * Keep .np inside .dock.
 */
export function Dock() {
  const { view, playing, records, grooves, cur, global, onAir } = useSite();
  const business = !!global.site?.business_enabled;
  const on = section(view);
  const tabs = TABS.filter(([href]) => business || href !== "/business");
  const at = tabs.findIndex(([href]) => href === on);
  // Off the tabbed sections the knob fades out where it was rather than sliding home.
  const [last, setLast] = useState(at);
  if (at >= 0 && at !== last) setLast(at);
  const bar = useRef<HTMLElement>(null);
  const knob = useRef<HTMLSpanElement>(null);
  const was = useRef(at);
  const e = records[cur];
  const eq = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const from = was.current;
    was.current = at;
    if (from < 0 || at < 0 || from === at || still()) return;
    knob.current?.animate([{ scale: "1 1" }, { scale: "1.2 .86", offset: 0.4 }, { scale: "1 1" }], { duration: 560, easing: "cubic-bezier(.3,.7,.3,1)" });
  }, [at]);
  // Shrinks while you scroll down and comes back on the way up; every page starts with it full.
  useEffect(() => {
    const el = bar.current;
    if (!el || still()) return;
    let y0 = scrollY,
      raf = 0;
    const tick = () => {
      raf = 0;
      const y = scrollY;
      if (Math.abs(y - y0) < 10) return;
      el.toggleAttribute("data-min", y > y0 && y > 120);
      y0 = y;
    };
    const onScroll = () => {
      raf ||= requestAnimationFrame(tick);
    };
    addEventListener("scroll", onScroll, { passive: true });
    return () => {
      removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
      el.removeAttribute("data-min");
    };
  }, [on]);
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
        <span>{onAir ? `HOY Radio · ${onAir.title} by ${onAir.artist}` : e ? `HOY Radio · ${grooves[cur]?.label} · ${grooves[cur]?.bpm} BPM` : ""}</span>
        <button aria-label="Stop" onClick={() => stop()}>
          ■
        </button>
      </div>
      <nav className="tabs" ref={bar} aria-label="Sections" style={{ "--n": tabs.length, "--i": Math.max(0, at >= 0 ? at : last) } as React.CSSProperties}>
        <span className={at < 0 ? "knob off" : "knob"} ref={knob}></span>
        {tabs.map(([href, label, icon]) => (
          <Link key={href} href={href} className={on === href ? "on" : ""} aria-current={on === href ? "page" : undefined}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              {icon}
            </svg>
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
