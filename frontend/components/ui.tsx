"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { field } from "@/lib/art";
import { isHttp } from "@/lib/format";

/**
 * Prototype words(): each word in `.wd > span[--i]`; an italic part stays one unit.
 * Separated by a plain space text node, like the prototype's join(" ").
 */
export function Words({ parts }: { parts: { t: string; it?: boolean }[] }) {
  const units: { t: string; it?: boolean }[] = [];
  for (const p of parts) {
    if (p.it) units.push(p);
    else p.t.split(" ").filter(Boolean).forEach((w) => units.push({ t: w }));
  }
  return (
    <>
      {units.map((u, i) => (
        <Fragment key={i}>
          {i > 0 && " "}
          <span className="wd">
            <span style={{ "--i": i } as React.CSSProperties}>{u.it ? <span className="it">{u.t}</span> : u.t}</span>
          </span>
        </Fragment>
      ))}
    </>
  );
}

/** Canvas filled with the prototype's field() art. Used only when a real image is missing. */
export function FieldCanvas({ seed, w = 480, h = 600, className }: { seed: number; w?: number; h?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) field(ref.current, seed, w, h);
  }, [seed, w, h]);
  return <canvas ref={ref} className={className} aria-hidden="true" />;
}

/**
 * A real image (lazy, with intrinsic width/height so nothing shifts), falling back to
 * field() art when the URL is missing or fails to load.
 */
export function Img({
  src,
  alt,
  seed,
  w,
  h,
  className,
  eager,
}: {
  src: string | null | undefined;
  alt: string;
  seed: number;
  w: number;
  h: number;
  className?: string;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (!isHttp(src) || failed) return <FieldCanvas seed={seed} w={w} h={h} className={className} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote media from the API/R2, sized by CSS
    <img
      src={src!}
      alt={alt}
      width={w}
      height={h}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      className={className}
      onError={() => setFailed(true)}
    />
  );
}

/**
 * The cursor-following preview. Rows/names carry data-peek="<image url>" or "seed:<n>";
 * components/effects.tsx moves it and swaps the picture.
 */
export function Peek() {
  return (
    <div className="peek" aria-hidden="true">
      <canvas width={320} height={400} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" width={320} height={400} hidden />
    </div>
  );
}

export const peekOf = (src: string | null | undefined, seed: number) => (isHttp(src) ? src! : `seed:${seed}`);
