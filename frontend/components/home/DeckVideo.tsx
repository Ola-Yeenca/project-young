"use client";

// The homepage video, looping behind the record player under the hero's dark wash. Built in the
// DOM after hydration: the server can't know reduced motion or the connection, so the markup is
// always an empty box on both sides. The first video waits for the page's load event and an idle
// moment, so it never competes with the page itself; later city switches start straight away.

import { useEffect, useEffectEvent, useRef } from "react";
import { lowData, RM } from "@/lib/format";

let pageLoaded = false;
const afterLoad = (f: () => void) => {
  if (pageLoaded) return f();
  const idle = () => {
    pageLoaded = true;
    if ("requestIdleCallback" in window) requestIdleCallback(f, { timeout: 1500 });
    else setTimeout(f, 200);
  };
  if (document.readyState === "complete") idle();
  else addEventListener("load", idle, { once: true });
};

/** Pauses a video and drops its source, which also aborts a download still in progress. */
const stop = (el: Element) => {
  if (!(el instanceof HTMLVideoElement)) return;
  el.pause();
  el.removeAttribute("src");
  el.load();
};

export function DeckVideo({ video, poster }: { video?: string | null; poster?: string | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const playing = useRef<HTMLVideoElement | null>(null);
  const seen = useRef(true);
  const refused = useRef(false);

  const sync = useEffectEvent(() => {
    const v = playing.current;
    if (!v) return;
    if (!seen.current || document.hidden) return v.pause();
    v.play().then(
      () => (refused.current = false),
      (e: DOMException) => (refused.current = e.name === "NotAllowedError"),
    );
  });

  useEffect(() => {
    const box = ref.current;
    if (!box) return;
    const io = new IntersectionObserver(([en]) => {
      seen.current = en.isIntersecting;
      sync();
    });
    io.observe(box);
    const vis = () => sync();
    document.addEventListener("visibilitychange", vis);
    // Low Power Mode and some data savers refuse autoplay until the visitor touches the page: the
    // still stays up until then, and the first tap, click or key press starts the video.
    const unlock = () => refused.current && sync();
    const gestures = ["touchend", "click", "keydown"] as const;
    gestures.forEach((t) => document.addEventListener(t, unlock, { capture: true, passive: true }));
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", vis);
      gestures.forEach((t) => document.removeEventListener(t, unlock, { capture: true }));
      [...box.children].forEach(stop);
    };
  }, []);

  /* Cross-fades in this city's video (or still) once it can paint, then drops the previous one. */
  useEffect(() => {
    const box = ref.current;
    if (!box) return;
    let live = true,
      shown = false;
    const old = [...box.children];
    const show = (el: HTMLElement | null) => {
      if (!live || shown) return;
      shown = true;
      old.forEach((o) => o.classList.remove("in"));
      setTimeout(() => {
        old.forEach(stop);
        old.forEach((o) => o.remove());
      }, 900);
      if (el) requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("in")));
    };
    const still = (src: string, into: HTMLElement | null = null) => {
      const img = new Image();
      img.alt = "";
      img.decoding = "async";
      img.onload = () => show(into ?? img);
      if (!into) {
        img.onerror = () => show(null);
        box.appendChild(img);
      }
      img.src = src;
    };
    afterLoad(() => {
      if (!live) return;
      playing.current = null;
      const calm = RM() || lowData();
      if (!video || (calm && poster)) return poster ? still(poster) : show(null);
      const v = document.createElement("video");
      v.muted = true;
      v.setAttribute("muted", ""); // iOS only autoplays inline videos that start out muted
      v.loop = true;
      v.playsInline = true;
      v.disablePictureInPicture = true;
      v.preload = calm ? "metadata" : "auto";
      v.autoplay = !calm;
      v.addEventListener("loadeddata", () => show(v), { once: true });
      if (!calm) v.addEventListener("canplay", () => sync());
      v.addEventListener("error", () => !shown && (poster ? still(poster) : show(null)), { once: true });
      if (poster) {
        v.poster = poster;
        still(poster, v);
      }
      // Without a still, a paused video shows the frame at 0.1s instead (Safari needs the fragment).
      v.src = calm ? `${video}#t=0.1` : video;
      box.appendChild(v);
      if (!calm) {
        playing.current = v;
        sync();
      }
    });
    return () => {
      live = false;
    };
  }, [video, poster]);

  return <div className="film" ref={ref} aria-hidden="true"></div>;
}
