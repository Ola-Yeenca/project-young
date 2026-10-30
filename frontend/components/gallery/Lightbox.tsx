"use client";

// A gallery photo full screen: where it was taken, how many people opened and downloaded it,
// and a credited download. Opening a photo counts as a view.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Img } from "../ui";
import type { Shot } from "../home/sections/shared";
import { base } from "@/lib/api";
import { choose, deviceId, useDeviceChoice } from "@/lib/device";
import { pad, seedOf } from "@/lib/format";

type Counts = { views: number; downloads: number };

const when = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "");

/** Asked once; the answer can be changed on the privacy page. */
function DeviceAsk() {
  const c = useDeviceChoice();
  if (c !== null) return null;
  return (
    <div className="lb-ask" role="region" aria-label="Device recognition">
      <p>
        Remember this device for gallery stats? It never uses your name or a cookie. <Link href="/privacy#gallery">Learn more</Link>
      </p>
      <button className="on" onClick={() => choose("yes")}>
        Allow
      </button>
      <button onClick={() => choose("no")}>No</button>
    </div>
  );
}

/** For the privacy page: the visitor's current choice, switchable. */
export function DeviceSetting() {
  const c = useDeviceChoice();
  if (c === "unknown") return null;
  const on = c === "yes";
  return (
    <label className="toggle">
      <input type="checkbox" checked={on} onChange={() => choose(on ? "no" : "yes")} />
      <span>Recognise this device for gallery stats</span>
    </label>
  );
}

export function Lightbox({ shots, at, go, close }: { shots: Shot[]; at: number | null; go: (i: number) => void; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const shot = at === null ? null : shots[at];
  const item = shot?.item;
  const consent = useDeviceChoice();
  const [device, setDevice] = useState("");
  const [counts, setCounts] = useState<Record<number, Counts>>({});

  const open = !!shot;
  useEffect(() => {
    if (open && !ref.current?.open) ref.current?.showModal();
  }, [open]);

  useEffect(() => {
    let live = true;
    deviceId().then((id) => live && setDevice(id));
    return () => {
      live = false;
    };
  }, [consent]);

  useEffect(() => {
    if (!item || item.kind !== "photo") return;
    let live = true;
    deviceId()
      .then((dev) =>
        fetch(`${base()}/photos/${item.id}/view/`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ device: dev }),
        }),
      )
      .then((r) => (r.ok ? r.json() : null))
      .then((c: Counts | null) => live && c && setCounts((m) => ({ ...m, [item.id]: c })))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [item]);

  const n = shots.length;
  const step = (d: number) => at !== null && go((at + d + n) % n);
  const c = item ? (counts[item.id] ?? { views: item.views, downloads: item.downloads }) : null;
  if (!shot || !item || !c) return null;
  const { album } = shot;
  const photo = item.kind === "photo";

  return createPortal(
    <dialog
      ref={ref}
      className="lb"
      aria-label={`${album.event_title || album.title}, photo ${(at ?? 0) + 1} of ${n}`}
      onClose={close}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") step(1);
        if (e.key === "ArrowLeft") step(-1);
      }}
    >
      <div className="lb-top">
        <span className="mono">
          {pad((at ?? 0) + 1)} / {pad(n)}
        </span>
        <button className="lb-x" aria-label="Close" onClick={close}>
          ×
        </button>
      </div>
      <div className="lb-ph" key={item.id} onClick={(e) => e.target === e.currentTarget && close()}>
        <Img src={item.image} alt={item.alt || item.caption || album.title} seed={seedOf(album.slug) + item.id} w={1200} h={900} eager />
        {n > 1 && (
          <>
            <button className="lb-nav prev" aria-label="Previous photo" onClick={() => step(-1)}>
              ←
            </button>
            <button className="lb-nav next" aria-label="Next photo" onClick={() => step(1)}>
              →
            </button>
          </>
        )}
      </div>
      <DeviceAsk />
      <div className="lb-bar">
        <div className="lb-meta">
          <b>{album.event_title || album.title}</b>
          <span>
            {album.city.name}
            {album.date && ` · ${when(album.date)}`}
            {album.event && (
              <>
                {" · "}
                <Link href={`/events/${album.event}`}>Event →</Link>
              </>
            )}
          </span>
        </div>
        {photo && (
          <span className="lb-num" aria-label={`${c.views} views, ${c.downloads} downloads`}>
            {c.views} {c.views === 1 ? "view" : "views"} · {c.downloads} {c.downloads === 1 ? "download" : "downloads"}
          </span>
        )}
        {photo ? (
          <a
            className="lb-dl"
            href={`${base()}/photos/${item.id}/download/${device ? `?d=${device}` : ""}`}
            download
            title="Free for personal use. Credit House of Young when you share."
            onClick={() => setCounts((m) => ({ ...m, [item.id]: { ...c, downloads: c.downloads + 1 } }))}
          >
            Download <span aria-hidden="true">↓</span>
          </a>
        ) : (
          item.video_url && (
            <a className="lb-dl" href={item.video_url} target="_blank" rel="noopener">
              Watch <span aria-hidden="true">↗</span>
            </a>
          )
        )}
      </div>
    </dialog>,
    document.body,
  );
}
