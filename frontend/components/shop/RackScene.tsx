"use client";

// Client-only (loaded with next/dynamic, ssr: false): builds garment textures from the product
// photos, then hands them to the three.js rack in ./scene.

import { useEffect, useEffectEvent, useRef } from "react";
import { garmentArt } from "@/lib/garment";
import { seedOf } from "@/lib/format";
import type { Product } from "@/lib/types";
import { createRack, type Rack } from "./scene";

export type RackSceneProps = {
  products: Product[];
  selected: number | null;
  flipped: boolean;
  onPick: (i: number | null) => void;
  onHover: (i: number | null) => void;
  onReady: () => void;
  onFail: () => void;
};

export default function RackScene({ products, selected, flipped, onPick, onHover, onReady, onFail }: RackSceneProps) {
  const host = useRef<HTMLDivElement>(null);
  const rack = useRef<Rack | null>(null);
  const pick = useEffectEvent(onPick);
  const hover = useEffectEvent(onHover);
  const ready = useEffectEvent(onReady);
  const fail = useEffectEvent(onFail);
  const state = useEffectEvent(() => ({ selected, flipped }));
  const key = products.map((p) => `${p.slug}|${p.image}|${p.back_image}`).join("\n");

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let dead = false;
    const small = Math.min(screen.width, screen.height) < 700;
    Promise.all(products.map((p) => garmentArt(p.image || p.images[0]?.url || null, p.back_image, seedOf(p.slug), small ? 384 : 640)))
      .then((arts) => {
        if (dead) return;
        rack.current = createRack(el, arts, { onPick: pick, onHover: hover, onLost: fail });
        rack.current.set(state());
        ready();
      })
      .catch(() => !dead && fail());
    return () => {
      dead = true;
      rack.current?.dispose();
      rack.current = null;
    };
    // `key` stands in for `products`: a refetch with the same content keeps the scene
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    rack.current?.set({ selected, flipped });
  }, [selected, flipped]);

  return <div ref={host} className="rack-host" />;
}
