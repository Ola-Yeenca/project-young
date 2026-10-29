"use client";

// The merch rack on /shop: every published product hangs on a 3D clothing rail. Without WebGL,
// with reduced motion, or on request it's a plain grid instead. Both lead to the existing
// product focus (sizes, price, Buy) below.

import dynamic from "next/dynamic";
import { useState, useSyncExternalStore } from "react";
import { Img } from "../ui";
import { money, pad, seedOf } from "@/lib/format";
import type { City, Product } from "@/lib/types";

const RackScene = dynamic(() => import("./RackScene"), { ssr: false });

/** Most garments the 3D rail carries; the grid and the pager below still list every product. */
const MAX_3D = 24;

type Caps = "pending" | "none" | "gl" | "gl-rm";

let glCache: boolean | null = null;
function hasWebGL() {
  if (glCache === null) {
    try {
      const cv = document.createElement("canvas");
      glCache = !!(cv.getContext("webgl2") || cv.getContext("webgl"));
    } catch {
      glCache = false;
    }
  }
  return glCache;
}

const RM_QUERY = "(prefers-reduced-motion: reduce)";
function useCaps(): Caps {
  return useSyncExternalStore(
    (fn) => {
      const m = matchMedia(RM_QUERY);
      m.addEventListener("change", fn);
      return () => m.removeEventListener("change", fn);
    },
    () => (!hasWebGL() ? "none" : matchMedia(RM_QUERY).matches ? "gl-rm" : "gl"),
    () => "pending",
  );
}

const priceOf = (p: Product, city: City) => {
  const x = p.prices.find((y) => y.city === city.slug) ?? p.prices[0];
  return x ? { label: money(x.currency_symbol, Number(x.amount)), url: x.checkout_url } : null;
};

type Props = {
  products: Product[];
  city: City;
  /** The product shown in the focus below; on the rack it's the one turned to the front when `open`. */
  index: number;
  open: boolean;
  onOpen: (i: number | null) => void;
  /** Go to the product's details (sizes, Buy) below the rack. */
  onDetails: (i: number) => void;
};

export function Rack({ products, city, index, open, onOpen, onDetails }: Props) {
  const caps = useCaps();
  const [view, setView] = useState<"rack" | "grid" | null>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [hover, setHover] = useState<number | null>(null);

  const can3d = (caps === "gl" || caps === "gl-rm") && !failed;
  const mode = caps === "pending" ? "pending" : can3d && (view ?? (caps === "gl" ? "rack" : "grid")) === "rack" ? "rack" : "grid";
  const hung = products.slice(0, MAX_3D);
  const picked = open && index < hung.length ? index : null;

  const pick = (i: number | null) => {
    if (i === null) {
      setFlipped(false);
      onOpen(null);
    } else if (i === picked) {
      setFlipped((f) => !f);
    } else {
      setFlipped(false);
      onOpen(i);
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    const n = hung.length;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const from = picked ?? (e.key === "ArrowRight" ? -1 : n);
      pick((from + (e.key === "ArrowRight" ? 1 : -1) + n) % n);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      pick(picked ?? 0);
    } else if (e.key === "Escape") pick(null);
  };

  const p = picked !== null ? hung[picked] : null;
  const price = p && priceOf(p, city);
  const hovered = hover !== null && hover !== picked ? hung[hover] : null;
  const touch = typeof window !== "undefined" && matchMedia("(pointer: coarse)").matches;

  return (
    <div className="rack" data-mode={mode}>
      {mode === "rack" ? (
        <div
          className="rack-stage"
          data-ready={ready ? "1" : "0"}
          tabIndex={0}
          role="group"
          aria-roledescription="clothing rack"
          aria-label={`Merch rack, ${hung.length} pieces. Left and right arrows pick a piece, Enter turns it round, Escape puts it back.`}
          onKeyDown={onKey}
        >
          <RackScene
            products={hung}
            selected={picked}
            flipped={flipped}
            onPick={pick}
            onHover={setHover}
            onReady={() => setReady(true)}
            onFail={() => setFailed(true)}
          />
          {!ready && <span className="mono rack-wait">Hanging the merch…</span>}
          <span className="mono rack-hint" aria-hidden="true">
            {hovered ? `${hovered.name}${priceOf(hovered, city) ? ` · ${priceOf(hovered, city)!.label}` : ""}` : touch ? "Drag the rail · tap a piece" : "Brush past the rail · click a piece"}
          </span>
          {p && (
            <div
              className="rack-card"
              key={p.slug}
              aria-live="polite"
              ref={(el) => el?.scrollIntoView({ block: "nearest", behavior: matchMedia(RM_QUERY).matches ? "auto" : "smooth" })}
            >
              <span className="mono">
                N° {pad(picked! + 1)} / {pad(products.length)}
              </span>
              <h3>{p.name}</h3>
              {price && <b className="rack-price">{price.label}</b>}
              <div className="rack-acts">
                <button className="btn sm ink" onClick={() => onDetails(picked!)}>
                  Sizes &amp; details <span className="ar">↓</span>
                </button>
                {price?.url && (
                  <a className="btn sm" href={price.url} target="_blank" rel="noopener">
                    Buy <span className="ar">↗</span>
                  </a>
                )}
                <button className="btn sm" onClick={() => setFlipped((f) => !f)} aria-pressed={flipped}>
                  {flipped ? "Front" : "Back"}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : mode === "grid" ? (
        <ul className="rack-grid">
          {products.map((x, i) => {
            const pr = priceOf(x, city);
            return (
              <li key={x.slug}>
                <button className="rack-tile" onClick={() => onDetails(i)}>
                  <Img src={x.image || x.images[0]?.url} alt={x.images[0]?.alt || x.name} seed={seedOf(x.slug)} w={480} h={480} />
                  <span className="rack-name">{x.name}</span>
                  {pr && <span className="mono">{pr.label}</span>}
                </button>
                {pr?.url && (
                  <a className="btn sm" href={pr.url} target="_blank" rel="noopener">
                    Buy <span className="ar">↗</span>
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="rack-stage" data-ready="0" />
      )}
      {can3d && mode !== "pending" && (
        <div className="rack-bar">
          <button className="mono" onClick={() => setView(mode === "rack" ? "grid" : "rack")}>
            {mode === "rack" ? "View as grid" : "View on the rack"}
          </button>
        </div>
      )}
    </div>
  );
}
