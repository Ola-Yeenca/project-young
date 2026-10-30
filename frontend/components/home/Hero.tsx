"use client";

// The turntable hero. Ported from the prototype's .hero markup and its JS: setRecord(), step(),
// ui(), the physics T + frame(), ripple(), the disc pointer handlers, countUp, the auto-advance
// interval and the Home keyboard. Per-frame work writes styles directly, never React state.

import { Fragment, useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from "react";
import { A, beatEnv, dueBars, hold, play, retune, scratch, stop, type Groove } from "@/lib/audio";
import { mediaSrc } from "@/lib/api";
import { loadImage, record } from "@/lib/art";
import { AUTO, RM, money, pad, priceOf, purchaseUrl, seedOf, soldOf } from "@/lib/format";
import { asksAfterBuying } from "@/lib/taste";
import type { EventItem } from "@/lib/types";
import { useSite } from "../site";
import { Words } from "../ui";
import { DeckVideo } from "./DeckVideo";

/* Module state, like the prototype's globals: survives leaving Home and coming back. */
const T = { ang: 0, v: 360 / 12000, target: 360 / 12000, drag: false, last: 0, lastA: 0, lastT: 0 };
let lastBar = -1;
let first = true; // the very first record drops in without a lift
let armDown = false; // the tonearm drops once, 700ms after load
const FALLBACK: Groove = { style: "afrobeats", bpm: 104, label: "Afrobeats", key: 0, seed: 1 };

const posters = new Map<string, Promise<HTMLImageElement | null>>();
const poster = (src: string) => {
  let p = posters.get(src);
  if (!p) posters.set(src, (p = loadImage(src)));
  return p;
};
const VINYL = "/vinyl.jpg";

/**
 * The record: a vinyl photo. Its 900×900 field-art stand-in (a grain pass per draw) is drawn
 * only if the photo fails or takes longer than 150ms to arrive.
 */
function paint(cv: HTMLCanvasElement, seed: number) {
  let drawn = false;
  const late = setTimeout(() => {
    drawn = true;
    record(cv, seed);
  }, 150);
  poster(VINYL).then((img) => {
    clearTimeout(late);
    if (!cv.isConnected) return;
    if (img) {
      cv.width = cv.height = 900;
      cv.getContext("2d")!.drawImage(img, 0, 0, 900, 900);
    } else if (!drawn) record(cv, seed);
  });
}

function countUp(node: Text, to: number, cur: string, dur = 900) {
  if (to === 0) {
    node.textContent = "Free";
    return;
  }
  if (RM()) {
    node.textContent = money(cur, to);
    return;
  }
  const t0 = performance.now();
  let raf = 0;
  const f = (n: number) => {
    const p = Math.max(0, Math.min(1, (n - t0) / dur)), // a rAF stamp can predate t0
      v = to * (1 - Math.pow(1 - p, 3));
    node.textContent = cur + Math.round(v).toLocaleString("en-GB");
    if (p < 1) raf = requestAnimationFrame(f);
  };
  raf = requestAnimationFrame(f);
  return () => cancelAnimationFrame(raf);
}

/** Prototype title: last word italic (a one-word title is all italic). */
const titleParts = (t: string) => {
  const w = t.split(" ");
  return w.length > 1 ? [{ t: w.slice(0, -1).join(" ") }, { t: w.at(-1)!, it: true }] : [{ t, it: true }];
};

export function Hero() {
  const { city, slug, records, grooves, visit, cur, setCur, playing, onAir, global, idle: idleRef, sheet, openSheet, bundle } = useSite();
  const ready = !!bundle;
  const n = records.length;
  const e: EventItem | undefined = records[cur];
  const groove = grooves[cur];
  // Bumped on every setRecord() so a re-pick of the same record re-runs it, as the prototype does.
  // A city switch changes `slug` (and the site resets cur to 0): the same change path, no remount.
  const [spin, setSpin] = useState(0);
  const tok = `${slug}:${e?.slug ?? ""}:${spin}`;

  const glowRef = useRef<HTMLDivElement>(null);
  const eqRef = useRef<HTMLSpanElement>(null);
  const platterRef = useRef<HTMLDivElement>(null);
  const pulseRef = useRef<HTMLDivElement>(null);
  const discRef = useRef<HTMLDivElement>(null);
  const rotRef = useRef<HTMLDivElement>(null);
  const armRef = useRef<HTMLDivElement>(null);
  const priceRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const soldRef = useRef<HTMLSpanElement>(null);
  const bpmRef = useRef(104);
  const shown = useRef<string | null>(null);

  const bpm = groove?.bpm ?? 104;
  useEffect(() => {
    bpmRef.current = bpm;
  }, [bpm]);

  const step = (d: number) => {
    if (!n) return;
    setCur((cur + d + n) % n);
    setSpin((s) => s + 1);
  };
  const toggle = () => (A.on ? stop() : play(groove ?? FALLBACK, slug, global.radio, visit));

  /* ---- ripple(): a gold ring under the disc ---- */
  const onRipple = useEffectEvent((o: number) => {
    const pl = platterRef.current,
      d = discRef.current;
    if (!pl || !d) return;
    const r = document.createElement("span");
    r.className = "ripple";
    r.style.opacity = String(o);
    pl.insertBefore(r, d);
    setTimeout(() => r.remove(), 1700);
  });

  /* ---- frame(): physics + beat-synced visuals, hero parts only ---- */
  useEffect(() => {
    const rm = RM();
    let raf = 0;
    const frame = (now: number) => {
      const dt = Math.min(50, now - (T.last || now));
      T.last = now;
      T.target = A.on ? (33.333 * 360) / 60000 : rm ? 360 / 40000 : 360 / 12000;
      if (!T.drag) {
        T.v += (T.target - T.v) * Math.min(1, dt / (A.on ? 260 : 900));
        T.ang += T.v * dt;
      }
      if (rotRef.current) rotRef.current.style.transform = `rotate(${T.ang % 360}deg)`;
      const e = beatEnv(now, bpmRef.current);
      const pu = pulseRef.current;
      if (pu) {
        pu.style.opacity = (A.on ? 0.15 + e * 0.8 : e * 0.5).toFixed(3);
        pu.style.transform = `scale(${1 + e * (A.on ? 0.06 : 0.02)})`;
      }
      if (glowRef.current) glowRef.current.style.opacity = (0.26 + e * (A.on ? 0.5 : 0.14)).toFixed(3);
      if (discRef.current) discRef.current.style.transform = `scale(${1 + e * (A.on ? 0.012 : 0)})`;
      const lvl = (i: number, base: number) => Math.max(0.15, Math.min(1, base + e * (0.5 + 0.5 * Math.sin(now / 90 + i * 1.7))));
      eqRef.current?.querySelectorAll<HTMLElement>("i").forEach((b, i) => (b.style.height = lvl(i, A.on ? 0.25 : 0.12) * 100 + "%"));
      if (A.on && A.ctx) for (let k = dueBars(); k > 0; k--) onRipple(1);
      else if (!rm) {
        const bar = Math.floor(((now / 1000) * bpmRef.current) / 60 / 4);
        if (bar !== lastBar) {
          lastBar = bar;
          onRipple(0.45);
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  /* ---- tonearm: drops at 700ms, .deep while playing ---- */
  useLayoutEffect(() => {
    const arm = armRef.current;
    if (!arm) return;
    if (armDown) {
      arm.classList.add("on");
      return;
    }
    const t = setTimeout(() => {
      armDown = true;
      arm.classList.add("on");
    }, 700);
    return () => clearTimeout(t);
  }, [ready]);
  useEffect(() => {
    armRef.current?.classList.toggle("deep", playing);
  }, [playing, ready]);

  /* ---- setRecord(): the disc. Cross-fades a new canvas over the old one. ---- */
  useEffect(() => {
    const rot = rotRef.current;
    if (!rot || shown.current === tok) return;
    shown.current = tok;
    if (groove) retune(groove, slug);
    const nc = document.createElement("canvas");
    paint(nc, seedOf(e ? e.slug : slug));
    if (first) {
      first = false;
      rot.appendChild(nc);
      return;
    }
    const arm = armRef.current;
    arm?.classList.add("lift");
    setTimeout(() => arm?.classList.remove("lift"), 420);
    T.v += 0.25;
    if (!rot.querySelector("canvas")) {
      rot.appendChild(nc);
      return;
    }
    nc.className = "next";
    rot.appendChild(nc);
    requestAnimationFrame(() => requestAnimationFrame(() => nc.classList.add("in")));
    // Remove only the canvases under this one, so a quick second change never blanks the disc.
    setTimeout(() => {
      if (!nc.isConnected) return;
      while (nc.previousElementSibling) nc.previousElementSibling.remove();
      nc.className = "";
    }, 750);
  }, [ready, tok, e, slug, groove]);

  /* ---- the wallpaper: this record's flyer, cross-faded in once it has loaded ---- */
  const wallRef = useRef<HTMLDivElement>(null);
  const wallSrc = mediaSrc(e?.poster);
  useEffect(() => {
    const box = wallRef.current;
    if (!box) return;
    let live = true;
    const show = (img: HTMLImageElement | null) => {
      if (!live) return;
      const old = [...box.children] as HTMLElement[];
      old.forEach((o) => o.classList.remove("in"));
      setTimeout(() => old.forEach((o) => o.remove()), 900);
      if (!img) return;
      const d = document.createElement("div");
      d.style.backgroundImage = `url(${JSON.stringify(img.src)})`;
      box.appendChild(d);
      requestAnimationFrame(() => requestAnimationFrame(() => d.classList.add("in")));
    };
    if (wallSrc) poster(wallSrc).then(show);
    else show(null);
    return () => {
      live = false;
    };
  }, [wallSrc]);

  /* ---- setRecord(): price countUp + sold meter ---- */
  useEffect(() => {
    if (!e) return;
    const stops: (() => void)[] = [];
    const pr = priceRef.current;
    if (pr) {
      pr.textContent = "";
      const small = document.createElement("small"),
        pn = document.createTextNode("");
      pr.append(small, pn);
      const p = priceOf(e);
      if (e.is_cancelled) {
        small.textContent = "Status";
        pn.textContent = "Cancelled";
      } else if (p === null) {
        small.textContent = "Tickets";
        pn.textContent = "TBA";
      } else {
        small.textContent = p ? "Tickets from" : "Entry";
        const c = countUp(pn, p, e.currency_symbol || city?.currency_symbol || "");
        if (c) stops.push(c);
      }
    }
    const sold = soldOf(e);
    const f = fillRef.current;
    if (f) {
      f.style.transition = "none";
      f.style.width = "0";
      void f.offsetWidth;
      f.style.transition = "";
      const r = requestAnimationFrame(() => (f.style.width = sold + "%"));
      stops.push(() => cancelAnimationFrame(r));
    }
    const s = soldRef.current;
    if (s) {
      if (sold >= 100) s.textContent = "Sold out · waitlist open";
      else if (RM()) s.textContent = sold + "% sold";
      else {
        const t0 = performance.now();
        let r = 0;
        const g = (x: number) => {
          const p = Math.max(0, Math.min(1, (x - t0) / 1200));
          s.textContent = Math.round(sold * (1 - Math.pow(1 - p, 3))) + "% sold";
          if (p < 1) r = requestAnimationFrame(g);
        };
        r = requestAnimationFrame(g);
        stops.push(() => cancelAnimationFrame(r));
      }
    }
    return () => stops.forEach((x) => x());
  }, [tok, e, city]);

  /* ---- auto-advance while idle; paused while the groove plays or a sheet is open ---- */
  const onTick = useEffectEvent(() => {
    idleRef.current += 250;
    if (idleRef.current >= AUTO && !A.on && !sheet) step(1);
  });
  useEffect(() => {
    const t = setInterval(() => onTick(), 250);
    return () => clearInterval(t);
  }, []);

  /* ---- keyboard: ← → step, Space play/stop ---- */
  const onKey = useEffectEvent((ev: KeyboardEvent) => {
    if (sheet || /INPUT|TEXTAREA|SELECT|BUTTON|A/.test(document.activeElement?.tagName ?? "")) return;
    if (ev.key === "ArrowRight") step(1);
    if (ev.key === "ArrowLeft") step(-1);
    if (ev.key === " ") {
      ev.preventDefault();
      toggle();
    }
  });
  useEffect(() => {
    const k = (ev: KeyboardEvent) => onKey(ev);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  /* ---- drag to scratch; a hand held still stops the record ---- */
  const angleAt = (ev: React.PointerEvent) => {
    const r = discRef.current!.getBoundingClientRect();
    return (Math.atan2(ev.clientY - (r.top + r.height / 2), ev.clientX - (r.left + r.width / 2)) * 180) / Math.PI;
  };
  const onDown = (ev: React.PointerEvent<HTMLDivElement>) => {
    T.drag = true;
    T.lastA = angleAt(ev);
    T.lastT = performance.now();
    ev.currentTarget.classList.add("grab");
    ev.currentTarget.setPointerCapture(ev.pointerId);
    hold(true); // idle is reset by the site-wide pointerdown listener
  };
  const onMove = (ev: React.PointerEvent<HTMLDivElement>) => {
    if (!T.drag) return;
    const a = angleAt(ev);
    let d = a - T.lastA;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    const now = performance.now(),
      dt = Math.max(1, now - T.lastT);
    T.ang += d;
    T.v = d / dt;
    T.lastA = a;
    T.lastT = now;
    scratch(d);
  };
  const onUp = (ev: React.PointerEvent<HTMLDivElement>) => {
    if (!T.drag) return;
    T.drag = false;
    ev.currentTarget.classList.remove("grab");
    hold(false);
  };

  const pv = n ? records[(cur - 1 + n) % n] : undefined,
    nx = n ? records[(cur + 1) % n] : undefined;
  const sold = e ? soldOf(e) : 0;
  const deckVideo = city?.deck_video || global.site?.deck_video,
    deckPoster = city?.deck_poster || global.site?.deck_poster;

  return (
    <div className={`hero grain${deckVideo || deckPoster ? " has-film" : ""}`}>
      <DeckVideo video={deckVideo} poster={deckPoster} />
      <div className="wall" ref={wallRef} aria-hidden="true"></div>
      <div className="glow" ref={glowRef}></div>
      {pv && nx && (
        <>
          <button className="side-disc l" aria-label="Previous event" onClick={() => step(-1)}>
            <span>{`${pad(((cur - 1 + n) % n) + 1)} — ${pv.title}`}</span>
          </button>
          <button className="side-disc r" aria-label="Next event" onClick={() => step(1)}>
            <span>{`${pad(((cur + 1) % n) + 1)} — ${nx.title}`}</span>
          </button>
        </>
      )}
      <div className="wrap">
        <div className="notes">
          <div className="kick">
            <span className="eq" ref={eqRef}>
              <i></i>
              <i></i>
              <i></i>
              <i></i>
            </span>
            <span className="mono">{`${playing ? "HOY Radio" : "Now spinning"} · ${city?.name ?? ""}${onAir ? ` · ${onAir.artist} – ${onAir.title}` : groove ? ` · ${groove.label}` : ""}`}</span>
          </div>
          <h1 key={tok}>{e ? <Words parts={titleParts(e.title)} /> : ready && <Words parts={titleParts("New dates soon")} />}</h1>
          <div className="kv swap" key={`kv:${tok}`}>
            {e && (
              <>
                <div style={{ "--i": 0 } as React.CSSProperties}>
                  <span>Date</span>
                  <span>{e.local.date}</span>
                </div>
                <div style={{ "--i": 1 } as React.CSSProperties}>
                  <span>Doors</span>
                  <span>{e.local.time}</span>
                </div>
                <div style={{ "--i": 2 } as React.CSSProperties}>
                  <span>Venue</span>
                  <span>{e.venue.name}</span>
                </div>
                <div style={{ "--i": 3 } as React.CSSProperties}>
                  <span>Line-up</span>
                  <span className="lu">
                    {e.lineup.map((l, i) => (
                      <Fragment key={i}>
                        {i > 0 && ", "}
                        {l.slug ? (
                          // A link, not a button: a button is an atomic inline box, so a name could
                          // not break across lines the way the prototype's plain text does.
                          <a
                            href={`/talent/${l.slug}`}
                            onClick={(ev) => {
                              if (ev.metaKey || ev.ctrlKey || ev.shiftKey) return;
                              ev.preventDefault();
                              openSheet("talent", l.slug!);
                            }}
                          >
                            {l.name}
                          </a>
                        ) : (
                          l.name
                        )}
                      </Fragment>
                    ))}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
        <div className={`platter${playing ? " playing" : ""}`} ref={platterRef}>
          {ready ? (
            <>
              <div className="pulse" ref={pulseRef}></div>
              <div className="disc" ref={discRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
                <div className="rot" ref={rotRef}></div>
                <div className="sheen"></div>
              </div>
              <button className="label" aria-pressed={playing} onClick={toggle}>
                <span className="in">
                  <small>{`N° ${e ? pad(cur + 1) : "00"} · ${bpm} BPM`}</small>
                  <b>{e ? e.title : city?.name}</b>
                  <span className="pl">{playing ? "Stop" : "Play"}</span>
                </span>
              </button>
              <div className="tonearm" ref={armRef}>
                <svg viewBox="0 0 100 180">
                  <circle cx="78" cy="14" r="11" fill="var(--bg-2)" stroke="var(--line-2)" />
                  <circle cx="78" cy="14" r="4" fill="var(--ink-2)" />
                  <path d="M78 14 L70 120 L46 150" fill="none" stroke="var(--ink-2)" strokeWidth="2.4" strokeLinecap="round" />
                  <rect x="36" y="146" width="18" height="10" rx="2" transform="rotate(-38 45 151)" fill="var(--ink)" />
                </svg>
              </div>
              <span className="hint" style={{ opacity: playing ? 0 : 1 }}>
                Tap the label to play · drag the record to scratch
              </span>
            </>
          ) : (
            <div className="sk sk-disc"></div>
          )}
        </div>
        <div className="buy">
          {e && (
            <>
              <div className="price" ref={priceRef}></div>
              {!e.is_cancelled && e.ticketing_mode !== "simulation" && (
                <div className="meter">
                  <div className="track">
                    <div className="fill" ref={fillRef}></div>
                  </div>
                  <span ref={soldRef}></span>
                </div>
              )}
              {!e.is_cancelled && purchaseUrl(e) && (
                <a
                  className="btn ink mag"
                  href={purchaseUrl(e)}
                  target={e.ticketing_mode === "simulation" ? undefined : "_blank"}
                  rel="noopener"
                  onClick={() => asksAfterBuying(e) && setTimeout(() => openSheet("event", e.slug, { taste: true }))}
                >
                  {e.ticketing_mode === "simulation" ? (
                    <>Get tickets · Nocheva <span className="ar">→</span></>
                  ) : sold >= 100 ? (
                    <>
                      Join waitlist <span className="ar">→</span>
                    </>
                  ) : (
                    <>
                      Buy on {e.ticket_provider} <span className="ar">↗</span>
                    </>
                  )}
                </a>
              )}
              {e.ticketing_mode === "simulation" && (
                <small style={{ color: "var(--mute)", fontSize: ".75rem" }}>Local simulation · no money collected</small>
              )}
              <button className="btn sm" onClick={() => openSheet("event", e.slug)}>
                Event details
              </button>
            </>
          )}
        </div>
      </div>
      <div className="hero-foot">
        <p className="cap swap" key={`cap:${tok}`}>
          {e && <span>{e.caption}</span>}
        </p>
        {e && (
          <div className="pager">
            <button className="arrow mag" aria-label="Previous" onClick={() => step(-1)}>
              ←
            </button>
            <div className={`dots${playing ? " hold" : ""}`}>
              {records.map((_, i) => (
                <button
                  key={`${tok}:${i}`}
                  className={i === cur ? "on" : ""}
                  style={{ "--dur": `${AUTO}ms` } as React.CSSProperties}
                  aria-label={`Event ${i + 1}`}
                  onClick={() => {
                    setCur(i);
                    setSpin((s) => s + 1);
                  }}
                ></button>
              ))}
            </div>
            <button className="arrow mag" aria-label="Next" onClick={() => step(1)}>
              →
            </button>
            <span className="n">{`${pad(cur + 1)} / ${pad(n)}`}</span>
          </div>
        )}
      </div>
    </div>
  );
}
