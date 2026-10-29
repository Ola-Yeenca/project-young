"use client";

// The city switch: a quick deal of gallery prints across a dark stage that covers the data swap.
// Only prints already downloaded are dealt (warmed when idle, or when a city button is hovered or
// focused), so the switch never waits for an image. With none, the dark stage wipes in and out on
// its own; with reduced motion it simply fades.

import { useLayoutEffect, useEffectEvent, useRef } from "react";
import { fmtT, isHttp, lowData, RM } from "@/lib/format";
import type { City, CityBundle } from "@/lib/types";

/** When the site swaps the city's data under the cover, in ms from the click. */
export const COVER = 420;
export const FADE = 160;
const HAND = 6;

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

const ease = "cubic-bezier(.2,.8,.2,1)",
  snap = "cubic-bezier(.6,.05,.2,1)",
  swing = "cubic-bezier(.7,0,.2,1)";
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
        stage.animate([{ opacity: 0 }, { opacity: 1 }], opts(FADE, "linear"));
        name.animate([{ opacity: 0 }, { opacity: 1 }], opts(FADE, "linear"));
        return;
      }
      if (hand.current.length) stage.animate([{ opacity: 0 }, { opacity: 1 }], opts(220, ease));
      else stage.animate([{ clipPath: "inset(0 100% 0 0)", opacity: 1 }, { clipPath: "inset(0 0 0 0)", opacity: 1 }], opts(380, swing));
      hand.current.forEach(({ img, side }, i) => {
        img.getAnimations().forEach((a) => a.cancel());
        const from = `translate(${side * 70}vw, ${rand(-25, 25)}vh) rotate(${side * rand(25, 45)}deg)`;
        const to = `translate(${rand(-9, 9)}vw, ${rand(-6, 6)}vh) rotate(${rand(-14, 14)}deg)`;
        img.animate([{ transform: from }, { transform: to }], opts(340, ease, i * 45));
      });
      name.animate([{ opacity: 0, transform: "translateY(14px)" }, { opacity: 1, transform: "none" }], opts(360, ease, 110));
      return;
    }

    const out: Animation[] = [];
    if (calm.current) {
      out.push(stage.animate([{ opacity: 1 }, { opacity: 0 }], opts(220, "linear")));
      out.push(name.animate([{ opacity: 1 }, { opacity: 0 }], opts(220, "linear")));
    } else {
      [...hand.current].reverse().forEach(({ img, side }, k) => {
        const at = getComputedStyle(img).transform;
        img.getAnimations().forEach((a) => a.cancel());
        const to = `translate(${-side * 80}vw, ${rand(-12, 12)}vh) rotate(${-side * rand(20, 35)}deg)`;
        out.push(img.animate([{ transform: at }, { transform: to }], opts(300, snap, k * 35)));
      });
      out.push(name.animate([{ opacity: 1 }, { opacity: 0 }], opts(200, "linear")));
      out.push(
        hand.current.length
          ? stage.animate([{ opacity: 1 }, { opacity: 0 }], opts(320, ease, 120))
          : stage.animate([{ clipPath: "inset(0 0 0 0)" }, { clipPath: "inset(0 0 0 100%)" }], opts(400, swing)),
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
