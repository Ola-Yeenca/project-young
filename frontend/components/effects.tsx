"use client";

// Global behaviours from the prototype that act on markup by class/attribute:
// grain noise, scroll reveals, magnetic buttons, cursor peeks with inertia, strip drift,
// parallax and drag. Same constants as the prototype.

import { useEffect } from "react";
import { field, installNoise } from "@/lib/art";

type PeekState = { x: number; y: number; vx: number; tx?: number; ty?: number };

export function Effects() {
  useEffect(() => {
    installNoise();
    // Only touch nodes React has already hydrated (they carry React's fiber key); changing a
    // server-rendered node before its boundary hydrates causes a hydration mismatch.
    const hydrated = (el: Element) => Object.keys(el).some((k) => k.startsWith("__reactFiber$"));
    const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* ---- scroll reveals: [data-rv] → data-rvs="pre" until in view, then "seen" ---- */
    const io = new IntersectionObserver(
      (es) =>
        es.forEach((en) => {
          if (en.isIntersecting) {
            (en.target as HTMLElement).dataset.rvs = "seen";
            io.unobserve(en.target);
          }
        }),
      { rootMargin: "0px 0px -6% 0px" },
    );
    const reveal = () => {
      const vh = window.innerHeight;
      document.querySelectorAll<HTMLElement>("[data-rv]:not([data-rvs])").forEach((el) => {
        if (!hydrated(el)) return;
        if (!el.offsetParent && getComputedStyle(el).position !== "fixed") return;
        const r = el.getBoundingClientRect();
        if (r.top < vh && r.bottom > 0) {
          el.dataset.rvs = "seen";
          return;
        }
        el.dataset.rvs = "pre";
        io.observe(el);
      });
    };
    let queued = 0;
    const mo = new MutationObserver(() => {
      if (queued) return;
      queued = requestAnimationFrame(() => {
        queued = 0;
        reveal();
      });
    });
    mo.observe(document.body, { childList: true, subtree: true });
    reveal();
    // Hydration doesn't mutate the DOM, so rescan briefly while streamed boundaries hydrate.
    let scans = 0;
    const rescan = setInterval(() => {
      reveal();
      if (++scans >= 20) clearInterval(rescan);
    }, 150);

    /* ---- magnetic buttons ---- */
    const onMag = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || RM) return;
      const m = (e.target as Element).closest?.(".mag") as HTMLElement | null;
      document.querySelectorAll<HTMLElement>(".mag[data-pull]").forEach((x) => {
        if (x !== m) {
          delete x.dataset.pull;
          x.style.translate = "";
        }
      });
      if (!m || !hydrated(m)) return;
      const r = m.getBoundingClientRect(),
        dx = e.clientX - (r.left + r.width / 2),
        dy = e.clientY - (r.top + r.height / 2);
      m.dataset.pull = "1";
      m.style.translate = `${(dx * 0.22).toFixed(1)}px ${(dy * 0.3).toFixed(1)}px`;
    };

    /* ---- cursor peeks with inertia ---- */
    const PK = new Map<HTMLElement, PeekState>();
    const onPeek = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const item = (e.target as Element).closest?.("[data-peek]") as HTMLElement | null;
      document.querySelectorAll<HTMLElement>(".peek.on").forEach((p) => {
        if (!item || !p.parentElement!.contains(item)) p.classList.remove("on");
      });
      if (!item) return;
      const wrap = item.closest("[data-peekwrap]");
      if (!wrap) return;
      const pk = wrap.querySelector<HTMLElement>(":scope > .peek");
      if (!pk) return;
      const r = wrap.getBoundingClientRect();
      let s = PK.get(pk);
      const tx = e.clientX - r.left + 140,
        ty = e.clientY - r.top;
      if (!s) {
        s = { x: tx, y: ty, vx: 0 };
        PK.set(pk, s);
      }
      s.tx = tx;
      s.ty = ty;
      const key = item.dataset.peek!;
      if (pk.dataset.k !== key) {
        pk.dataset.k = key;
        const cv = pk.querySelector("canvas")!,
          img = pk.querySelector("img")!;
        if (key.startsWith("seed:")) {
          field(cv, +key.slice(5), 320, 400);
          cv.hidden = false;
          img.hidden = true;
        } else {
          img.src = key;
          img.hidden = false;
          cv.hidden = true;
        }
        pk.classList.remove("on");
        void pk.offsetWidth;
      }
      pk.classList.add("on");
    };
    const peeks = () => {
      PK.forEach((s, pk) => {
        if (!pk.isConnected) {
          PK.delete(pk);
          return;
        }
        if (s.tx == null) return;
        const nx = s.x + (s.tx - s.x) * 0.16,
          ny = s.y + (s.ty! - s.y) * 0.16;
        s.vx = nx - s.x;
        s.x = nx;
        s.y = ny;
        pk.style.transform = `translate(${s.x}px,${s.y}px) translate(-50%,-50%) rotate(${Math.max(-14, Math.min(14, s.vx * 0.6)).toFixed(2)}deg)`;
      });
    };

    /* ---- strips: slow drift + parallax + mouse drag ---- */
    let stripHover = false;
    const onOver = (e: PointerEvent) => {
      stripHover = !!(e.target as Element).closest?.(".strip");
    };
    const strips = (dt: number) => {
      document.querySelectorAll<HTMLElement>(".strip").forEach((s) => {
        if (!s.offsetParent || !hydrated(s)) return;
        if (s.hasAttribute("data-drift") && !RM && !stripHover && !s.dataset.drag) {
          s.scrollLeft += dt * 0.025;
          if (s.scrollLeft >= s.scrollWidth - s.clientWidth - 1) s.scrollLeft = 0;
        }
        if (RM) return;
        const r = s.getBoundingClientRect(),
          cx = r.left + r.width / 2;
        s.querySelectorAll<HTMLElement>(".ph canvas,.ph img").forEach((c) => {
          const b = c.parentElement!.getBoundingClientRect(),
            off = (b.left + b.width / 2 - cx) / r.width;
          c.style.transform = `translateX(${(-off * 7).toFixed(2)}%)`;
        });
      });
    };
    const onDown = (e: PointerEvent) => {
      const s = (e.target as Element).closest?.(".strip") as HTMLElement | null;
      if (!s || e.pointerType === "touch") return;
      const x = e.clientX,
        l = s.scrollLeft;
      s.dataset.drag = "1";
      s.style.cursor = "grabbing";
      const mv = (ev: PointerEvent) => {
        s.scrollLeft = l - (ev.clientX - x);
      };
      const up = () => {
        delete s.dataset.drag;
        s.style.cursor = "";
        removeEventListener("pointermove", mv);
        removeEventListener("pointerup", up);
      };
      addEventListener("pointermove", mv);
      addEventListener("pointerup", up);
    };

    let raf = 0,
      last = 0;
    const frame = (now: number) => {
      const dt = Math.min(50, now - (last || now));
      last = now;
      peeks();
      strips(dt);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    document.addEventListener("pointermove", onMag);
    document.addEventListener("pointermove", onPeek);
    document.addEventListener("pointerover", onOver);
    document.addEventListener("pointerdown", onDown);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(rescan);
      mo.disconnect();
      io.disconnect();
      document.removeEventListener("pointermove", onMag);
      document.removeEventListener("pointermove", onPeek);
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerdown", onDown);
    };
  }, []);

  return null;
}
