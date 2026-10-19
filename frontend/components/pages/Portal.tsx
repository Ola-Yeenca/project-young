"use client";

// Each page's opening: a full-bleed dark stage that irises open on arrival, with its own
// moving art, so leaving Home feels like stepping into another room.

import { useSyncExternalStore } from "react";
import { useSite } from "../site";
import { FieldCanvas, Words } from "../ui";
import { interleave } from "../home/sections/shared";
import { isHttp, seedOf } from "@/lib/format";
import { MOTTO } from "../shell";

type CSS = React.CSSProperties;
type Part = { t: string; it?: boolean };

/** The current time, ticking every `ms`. 0 on the server and during hydration. */
function useNow(ms = 1000) {
  return useSyncExternalStore(
    (fn) => {
      const t = setInterval(fn, ms);
      return () => clearInterval(t);
    },
    () => Math.floor(Date.now() / ms) * ms,
    () => 0,
  );
}

export function Portal({ id, kicker, title, sub, stats, art }: { id: string; kicker: string; title: Part[]; sub?: string; stats?: [string, string][]; art: React.ReactNode }) {
  return (
    <header className={`portal grain p-${id}`}>
      <div className="p-art" aria-hidden="true">
        {art}
      </div>
      <div className="wrap p-in">
        <span className="mono p-kick">{kicker}</span>
        <h1 className="p-title">
          <Words parts={title} />
        </h1>
        {sub && <p className="p-sub">{sub}</p>}
        {stats && stats.length > 0 && (
          <div className="p-stats">
            {stats.map(([n, l], i) => (
              <div key={l} style={{ "--i": i } as CSS}>
                <b>{n}</b>
                <span>{l}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}

const bg = (src: string | null | undefined): CSS | undefined => (isHttp(src) ? { backgroundImage: `url(${JSON.stringify(src)})` } : undefined);

function Picture({ src, seed, className, style }: { src: string | null | undefined; seed: number; className?: string; style?: CSS }) {
  return isHttp(src) ? <div className={className} style={{ ...bg(src), ...style }} /> : <FieldCanvas seed={seed} w={360} h={450} className={className} />;
}

/* ---------------- events ---------------- */

const pad2 = (n: number) => String(n).padStart(2, "0");

function Countdown({ at }: { at: string }) {
  const now = useNow();
  const left = now ? Math.max(0, new Date(at).getTime() - now) : null;
  const parts: [string, string][] =
    left === null
      ? [
          ["––", "days"],
          ["––", "hrs"],
          ["––", "min"],
          ["––", "sec"],
        ]
      : [
          [pad2(Math.floor(left / 864e5)), "days"],
          [pad2(Math.floor(left / 36e5) % 24), "hrs"],
          [pad2(Math.floor(left / 6e4) % 60), "min"],
          [pad2(Math.floor(left / 1e3) % 60), "sec"],
        ];
  return (
    <div className="p-count" role="timer" aria-label="Time until the next event">
      {parts.map(([n, l]) => (
        <div key={l}>
          <b>{n}</b>
          <span>{l}</span>
        </div>
      ))}
    </div>
  );
}

export function EventsPortal() {
  const { bundle, city } = useSite();
  const events = bundle?.events ?? [];
  const next = events[0];
  return (
    <Portal
      id="events"
      kicker={`Events · ${city?.name ?? ""}`}
      title={[{ t: "What’s" }, { t: "next.", it: true }]}
      sub={next ? `Up next: ${next.title}, ${next.venue.name}.` : "New dates are on the way."}
      stats={city ? [[String(events.length), events.length === 1 ? "night coming up" : "nights coming up"], [city.ticket_provider, "tickets"]] : []}
      art={
        <>
          <div className="p-wash" style={bg(next?.poster)} />
          <div className="p-fan">
            {events.slice(0, 3).map((e, i) => (
              <Picture key={e.slug} src={e.poster} seed={seedOf(e.slug)} className="p-card" style={{ "--i": i } as CSS} />
            ))}
          </div>
          {next && <Countdown at={next.starts_at} />}
        </>
      }
    />
  );
}

/* ---------------- talent ---------------- */

export function TalentPortal() {
  const { bundle, city } = useSite();
  const talent = bundle?.talent ?? [];
  const names = talent.map((t) => t.name);
  const rows = names.length ? [names, [...names].reverse(), names.slice(1).concat(names.slice(0, 1))] : [["House of Young"]];
  const count = (g: string) => talent.filter((t) => t.group === g).length;
  return (
    <Portal
      id="talent"
      kicker={`Talent · ${city?.name ?? ""}`}
      title={[{ t: "The" }, { t: "roster.", it: true }]}
      sub="The artists, DJs and hosts behind every House of Young night. Book them for yours."
      stats={talent.length ? [[String(count("DJs")), "DJs"], [String(count("Live")), "live acts"], [String(count("Hosts")), "hosts"]] : []}
      art={
        <div className="p-names">
          {rows.map((r, i) => (
            <div key={i} className="p-row" style={{ "--i": i } as CSS}>
              {[0, 1].map((k) => (
                <span key={k}>
                  {r.map((n) => (
                    <em key={n}>{n}</em>
                  ))}
                </span>
              ))}
            </div>
          ))}
        </div>
      }
    />
  );
}

/* ---------------- gallery ---------------- */

export function GalleryPortal() {
  const { bundle, city } = useSite();
  const albums = bundle?.albums ?? [];
  const shots = interleave(albums).filter((s) => s.item.image);
  const photos = albums.reduce((n, a) => n + (a.item_count || a.items?.length || 0), 0);
  const tiles = Array.from({ length: 12 }, (_, i) => shots.length ? shots[i % shots.length].item.image : null);
  return (
    <Portal
      id="gallery"
      kicker={`Gallery · ${city?.name ?? ""}`}
      title={[{ t: "The rooms" }, { t: "we filled.", it: true }]}
      sub="Every night, in pictures."
      stats={albums.length ? [[String(photos), "photos"], [String(albums.length), albums.length === 1 ? "night" : "nights"]] : []}
      art={
        <div className="p-wall">
          {[0, 1, 2].map((c) => (
            <div key={c} className="p-col" style={{ "--i": c } as CSS}>
              {[0, 1].map((rep) => tiles.filter((_, i) => i % 3 === c).map((src, i) => <Picture key={`${rep}-${i}`} src={src} seed={c * 10 + i + 1} className="p-tile" />))}
            </div>
          ))}
        </div>
      }
    />
  );
}

/* ---------------- shop ---------------- */

export function ShopPortal() {
  const { bundle, city } = useSite();
  const products = bundle?.products ?? [];
  const p = products[0];
  const ring = `House of Young · ${MOTTO.replace(/\.$/, "")} · `.repeat(2);
  return (
    <Portal
      id="shop"
      kicker={`Shop · ${city?.name ?? ""}`}
      title={[{ t: "Wear the" }, { t: "vision.", it: true }]}
      sub="HOY pieces, made for the community that fills the room."
      stats={city && products.length ? [[String(products.length), products.length === 1 ? "piece" : "pieces"], [city.currency, `ships from ${city.name}`]] : []}
      art={
        <div className="p-obj">
          <svg className="p-ring" viewBox="0 0 400 400">
            <defs>
              <path id="ring" d="M200,200 m-170,0 a170,170 0 1,1 340,0 a170,170 0 1,1 -340,0" />
            </defs>
            <text>
              <textPath href="#ring">{ring}</textPath>
            </text>
          </svg>
          <Picture src={p?.images[0]?.url || p?.image} seed={seedOf(p?.slug ?? "hoy")} className="p-piece" />
        </div>
      }
    />
  );
}

/* ---------------- about ---------------- */

const SPOTS: [number, number][] = [
  [330, 190],
  [700, 420],
  [540, 120],
  [860, 240],
];

export function StoryPortal() {
  const { cities, city, bundle, global } = useSite();
  const spots = cities.slice(0, SPOTS.length).map((c, i) => ({ c, at: SPOTS[i] }));
  const arcs = spots.slice(1).map(({ at: [x, y] }, i) => {
    const [x0, y0] = spots[i].at;
    return `M${x0},${y0} Q${(x0 + x) / 2 + 60},${Math.min(y0, y) - 160} ${x},${y}`;
  });
  const nights = bundle ? bundle.events.length + bundle.past.length : 0;
  return (
    <Portal
      id="story"
      kicker="Our story · Since 2022"
      title={[{ t: "House of" }, { t: "Young.", it: true }]}
      sub={global.site?.tagline || MOTTO}
      stats={[
        ["2022", "founded"],
        [String(cities.length), cities.length === 1 ? "city" : "cities"],
        ...(bundle && city ? ([[String(nights), `nights in ${city.name}`], [String(bundle.talent.length), "on the roster"]] as [string, string][]) : []),
      ]}
      art={
        <>
          <div className="p-year">2022</div>
          <svg className="p-map" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice">
            {arcs.map((d, i) => (
              <g key={i}>
                <path id={`arc-${i}`} className="p-arc" d={d} />
                <circle className="p-dot" r="4">
                  <animateMotion dur="5s" repeatCount="indefinite" rotate="auto">
                    <mpath href={`#arc-${i}`} />
                  </animateMotion>
                </circle>
              </g>
            ))}
            {spots.map(({ c, at: [x, y] }, i) => (
              <g key={c.slug} className={c.slug === city?.slug ? "p-city on" : "p-city"} style={{ "--i": i } as CSS}>
                <circle className="ring" cx={x} cy={y} r="10" />
                <circle className="core" cx={x} cy={y} r="5" />
                <text x={x + 18} y={y + 5}>
                  {c.name}
                </text>
              </g>
            ))}
          </svg>
        </>
      }
    />
  );
}

/* ---------------- contact ---------------- */

function Clock({ tz, name, now, slot }: { tz: string; name: string; now: number; slot: number }) {
  const t = now ? new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(now) : "––:––";
  return (
    <div className={slot === 0 ? "p-clock on" : "p-clock"} style={{ "--slot": slot } as CSS}>
      <b>{t}</b>
      <span>{slot === 0 ? `${name} · you’re here` : name}</span>
    </div>
  );
}

export function ContactPortal() {
  const { cities, city } = useSite();
  const now = useNow(1000);
  // Rendered in a fixed order so each clock keeps its node and glides to its new slot on a switch.
  const order = [...cities].sort((a, b) => Number(b.slug === city?.slug) - Number(a.slug === city?.slug));
  return (
    <Portal
      id="contact"
      kicker={`Contact · ${city?.name ?? ""}`}
      title={[{ t: "Let’s" }, { t: "talk.", it: true }]}
      sub="Book an act, plan a night, or just say hi."
      art={
        <div className="p-clocks" style={{ "--n": cities.length } as CSS}>
          {cities.map((c) => (
            <Clock key={c.slug} tz={c.timezone} name={c.name} now={now} slot={order.indexOf(c)} />
          ))}
        </div>
      }
    />
  );
}
