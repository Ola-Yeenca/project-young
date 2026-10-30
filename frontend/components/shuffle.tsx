"use client";

// The city switch: gallery prints dealt one by one across a dark stage that covers the data swap.
// Only prints already downloaded are dealt (warmed when idle, or when a city button is hovered or
// focused), so the switch never waits for an image. With none, the dark stage wipes in and out on
// its own; with reduced motion it simply fades.

import { useLayoutEffect, useEffectEvent, useRef } from "react";
import { fmtT, isHttp, lowData, RM } from "@/lib/format";
import type { City, CityBundle } from "@/lib/types";

/** The whole switch, from the click to the new city fully revealed, in ms. Tune it here. */
export const SHUFFLE_MS = 2000;
/** From here the city's data may swap in, unseen under the cover. */
export const COVER = SHUFFLE_MS * 0.25;
/** From here the new city is revealed, or once its data arrives if that's later. */
export const REVEAL = SHUFFLE_MS * 0.7;
/** Each half of the reduced-motion fade. */
export const FADE = 150;
const HAND = 4;

const ready = new Map<string, HTMLImageElement>();
const asked = new Set<string>();

const photosOf = (b?: CityBundle) =>
  (b?.albums ?? []).flatMap((a) => [a.cover, ...(a.items ?? []).filter((i) => i.kind === "photo").map((i) => i.image)]).filter(isHttp) as string[];
const postersOf = (b?: CityBundle) => (b ? [...b.featured, ...b.events, ...b.past].map((e) => e.poster) : []).filter(isHttp) as string[];

/** Downloads a handful of a city's prints in the background, once each. */
export function warmPrints(b: CityBundle | undefined) {
  if (!b || RM() || lowData()) return;
  for (const url of [...new Set([...photosOf(b), ...postersOf(b)])].slice(0, HAND)) {
    if (asked.has(url)) continue;
    asked.add(url);
    const img = new Image();
    img.alt = "";
    img.decoding = "async";
    img.draggable = false;
    img.onload = () => ready.set(url, img);
    img.src = url;
  }
}

export const warmPrintsSoon = (b: CityBundle) =>
  "requestIdleCallback" in window ? requestIdleCallback(() => warmPrints(b), { timeout: 4000 }) : setTimeout(() => warmPrints(b), 300);

/** The destination's photos first, then the other cities', then event posters; loaded ones only. */
function deal(to: string, bundles: Record<string, CityBundle>) {
  const others = Object.values(bundles).filter((b) => b.city !== to);
  const order = [photosOf(bundles[to]), ...others.map(photosOf), postersOf(bundles[to]), ...others.map(postersOf)].flat();
  return [...new Set(order)].flatMap((u) => ready.get(u) ?? []).slice(0, HAND);
}

const ease = "cubic-bezier(.22,.9,.3,1)",
  away = "cubic-bezier(.55,0,.7,.3)",
  swing = "cubic-bezier(.65,0,.35,1)";
const T = SHUFFLE_MS,
  FLY = T * 0.2;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const settled = (list: Animation[]) => Promise.all(list.map((a) => a.finished.catch(() => null)));

export function Shuffle({ wipe, bundles, done }: { wipe: { to: City; phase: "in" | "out" } | null; bundles: Record<string, CityBundle>; done: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const hand = useRef<{ img: HTMLImageElement; side: number }[]>([]);
  const calm = useRef(false);
  const phase = wipe?.phase;
  const pick = useEffectEvent(() => (wipe ? deal(wipe.to.slug, bundles) : []));

  useLayoutEffect(() => {
    const w = ref.current;
    if (!w || !phase) return;
    const [stage, pile, name] = [...w.children] as HTMLElement[];
    const opts = (duration: number, easing: string, delay = 0): KeyframeAnimationOptions => ({ duration, easing, delay, fill: "both" });

    if (phase === "in") {
      [stage, name].forEach((el) => el.getAnimations().forEach((a) => a.cancel()));
      calm.current = RM();
      hand.current = calm.current ? [] : pick().map((img, i) => ({ img, side: i % 2 ? -1 : 1 }));
      pile.replaceChildren(...hand.current.map((p) => p.img));
      if (calm.current) {
        stage.animate([{ opacity: 0 }, { opacity: 1 }], opts(FADE, "ease"));
        name.animate([{ opacity: 0 }, { opacity: 1 }], opts(FADE, "ease"));
        return;
      }
      if (hand.current.length) stage.animate([{ opacity: 0 }, { opacity: 1 }], opts(T * 0.1, ease));
      else stage.animate([{ clipPath: "inset(0 100% 0 0)", opacity: 1 }, { clipPath: "inset(0 0 0 0)", opacity: 1 }], opts(T * 0.22, swing));
      // Each print glides in while the one before settles, then stays on top for one step; the
      // last one lands a step before the reveal and holds there if the city's data is late.
      const start = T * 0.08,
        step = (REVEAL - start - FLY * 0.6) / Math.max(1, hand.current.length);
      hand.current.forEach(({ img, side }, i) => {
        img.getAnimations().forEach((a) => a.cancel());
        const from = `translate(${side * 70}vw, ${rand(-20, 20)}vh) rotate(${side * rand(25, 40)}deg)`;
        const to = `translate(${rand(-8, 8)}vw, ${rand(-5, 3)}vh) rotate(${rand(-12, 12)}deg)`;
        img.animate([{ transform: from }, { transform: to }], opts(FLY, ease, start + i * step));
      });
      name.animate([{ opacity: 0, transform: "translateY(14px)" }, { opacity: 1, transform: "none" }], opts(T * 0.2, ease, T * 0.1));
      return;
    }

    const out: Animation[] = [];
    if (calm.current) {
      out.push(stage.animate([{ opacity: 1 }, { opacity: 0 }], opts(FADE, "ease")));
      out.push(name.animate([{ opacity: 1 }, { opacity: 0 }], opts(FADE, "ease")));
    } else {
      [...hand.current].reverse().forEach(({ img, side }, k) => {
        const at = getComputedStyle(img).transform;
        img.getAnimations().forEach((a) => a.cancel());
        const to = `translate(${-side * 80}vw, ${rand(-12, 12)}vh) rotate(${-side * rand(18, 30)}deg)`;
        out.push(img.animate([{ transform: at }, { transform: to }], opts(FLY, away, k * T * 0.04)));
      });
      out.push(name.animate([{ opacity: 1 }, { opacity: 0 }], opts(T * 0.15, "ease")));
      out.push(
        hand.current.length
          ? stage.animate([{ opacity: 1 }, { opacity: 0 }], opts(T * 0.25, swing, T * 0.08))
          : stage.animate([{ clipPath: "inset(0 0 0 0)" }, { clipPath: "inset(0 0 0 100%)" }], opts(T * 0.25, swing)),
      );
    }
    settled(out).then(() => {
      pile.replaceChildren();
      done();
    });
  }, [phase, done]);

  return (
    <div className={`wipe${wipe ? " on" : ""}`} ref={ref} aria-hidden="true">
      <i className="stage"></i>
      <div className="pile"></div>
      <div className="name">
        <b>{wipe?.to.name}</b>
        <span>{wipe ? `${fmtT(wipe.to.timezone, false)} local · tickets via ${wipe.to.ticket_provider}` : ""}</span>
      </div>
    </div>
  );
}
