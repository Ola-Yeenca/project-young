"use client";

// Markup shared by Home and the pages: the prototype's row(), hd, strip() frames and countUp().

import { useRef } from "react";
import { useSite } from "../../site";
import { Img, peekOf } from "../../ui";
import { money, pad, priceOf, RM, seedOf, tagOf } from "@/lib/format";
import type { Album, AlbumItem, EventItem } from "@/lib/types";

type CSS = React.CSSProperties;

/** Prototype hd: the .idx header row (shown from 760px). */
export function IdxHead() {
  return (
    <div className="hd">
      <span>N°</span>
      <span>Event</span>
      <span>Venue</span>
      <span>Date</span>
      <span>From</span>
      <span></span>
    </div>
  );
}

/** Prototype row(e, c, i, past, k). Click and Enter open the event sheet. */
export function Row({ e, i, k, past }: { e: EventItem; i: number; k: number; past: boolean }) {
  const { openSheet } = useSite();
  const tag = tagOf(e, past);
  const p = priceOf(e);
  const price = p === null ? "TBA" : money(e.currency_symbol, p);
  return (
    <div
      className="row"
      data-rv=""
      style={{ "--d": `${k * 70}ms` } as CSS}
      data-peek={peekOf(e.poster, seedOf(e.slug))}
      tabIndex={0}
      onClick={() => openSheet("event", e.slug)}
      onKeyDown={(ev) => {
        // preventDefault: the sheet moves focus to its close button, which this Enter would otherwise press.
        if (ev.key === "Enter") {
          ev.preventDefault();
          openSheet("event", e.slug);
        }
      }}
    >
      <span className="n">{pad(i + 1)}</span>
      <span className="t">
        {e.title}
        {tag && <em className={tag === "Selling fast" ? "hot" : ""}>{tag}</em>}
      </span>
      <span className="s">
        <span>{e.local.date}</span>
        <span>{e.venue.name}</span>
        {!past && <span>{price}</span>}
      </span>
      <span className="c">{e.venue.name}</span>
      <span className="c">{e.local.date}</span>
      <span className="c p">{past ? "Recap" : price}</span>
      <span className="a">→</span>
    </div>
  );
}

/** Shown inside an .idx when a city has no dates. */
export function NoDates() {
  return (
    <p className="mono" style={{ padding: "22px 14px" }}>
      New dates soon
    </p>
  );
}

export type Shot = { album: Album; item: AlbumItem };

/** Items from every album, taken in turn (album 1 item 1, album 2 item 1, …). */
export function interleave(albums: Album[]): Shot[] {
  const out: Shot[] = [];
  const max = Math.max(0, ...albums.map((a) => a.items?.length ?? 0));
  for (let j = 0; j < max; j++) for (const album of albums) if (album.items?.[j]) out.push({ album, item: album.items[j] });
  return out;
}

const ARS = ["4/5", "3/2", "4/5", "1/1", "4/5", "3/2", "4/5", "4/5"];

/** Prototype strip() frames. A video frame opens its link in a new tab (unless the strip was dragged). */
export function Frames({ shots, prefix }: { shots: Shot[]; prefix: string }) {
  const down = useRef(0);
  return (
    <>
      {shots.map(({ album, item }, i) => {
        const ar = ARS[i % ARS.length];
        const video = item.kind === "video";
        return (
          <figure
            key={`${prefix}-${item.id}`}
            className="frame"
            data-rv=""
            style={{ "--d": `${Math.min(i, 4) * 90}ms` } as CSS}
            onPointerDown={(ev) => (down.current = ev.clientX)}
            onClick={
              video && item.video_url
                ? (ev) => {
                    if (Math.abs(ev.clientX - down.current) < 6) window.open(item.video_url, "_blank", "noopener");
                  }
                : undefined
            }
          >
            <div className="ph" style={{ "--ar": ar } as CSS}>
              <Img src={item.image} alt={item.alt || item.caption || album.title} seed={seedOf(album.slug) + item.id} w={ar === "3/2" ? 820 : 560} h={480} />
              {video && <span className="play"></span>}
            </div>
            <figcaption className="meta">
              <span>{album.title}</span>
              <span>
                {video ? "Film" : "Frame"} {pad(i + 1)}
              </span>
            </figcaption>
          </figure>
        );
      })}
    </>
  );
}

/** Prototype countUp(): 900ms cubic-out, 0 → "Free", instant under reduced motion. Returns a canceller. */
export function countUp(node: HTMLElement, to: number, cur: string, dur = 900) {
  if (to === 0) {
    node.textContent = "Free";
    return () => {};
  }
  if (RM()) {
    node.textContent = money(cur, to);
    return () => {};
  }
  const t0 = performance.now();
  let raf = 0;
  const f = (n: number) => {
    const p = Math.max(0, Math.min(1, (n - t0) / dur)),
      v = to * (1 - Math.pow(1 - p, 3));
    node.textContent = cur + Math.round(v).toLocaleString("en-GB");
    if (p < 1) raf = requestAnimationFrame(f);
  };
  raf = requestAnimationFrame(f);
  return () => cancelAnimationFrame(raf);
}
