"use client";

// After a Buy tickets click the tickets open in a new tab; our tab turns into this one-screen step.

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { getTaste, markAsked, useMine, type TasteOption } from "@/lib/taste";
import type { EventItem } from "@/lib/types";
import { Close } from "../sheets/parts";
import { TasteForm } from "./TasteForm";

export function TasteStep({ e, done }: { e: EventItem; done: () => void }) {
  const [options, setOptions] = useState<TasteOption[] | null>(null);
  const [sent, setSent] = useState(false);
  const initial = useMine(e.slug) ?? null;
  const top = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLHeadingElement>(null);
  const close = useEffectEvent(done);

  useEffect(() => {
    markAsked(e.slug);
    top.current?.closest(".card")?.scrollTo({ top: 0 });
    head.current?.focus({ preventScroll: true });
    let live = true;
    getTaste(e.slug)
      .then((s) => {
        if (!live) return;
        if (s.open) setOptions(s.options);
        else close();
      })
      .catch(() => live && setOptions([]));
    return () => {
      live = false;
    };
  }, [e.slug]);

  return (
    <div className="taste" ref={top}>
      <div className="taste-top">
        <span className="mono">Your tickets opened in a new tab ↗</span>
        <Close />
      </div>
      {sent ? (
        <div className="sent" role="status">
          <span className="mono">Sent to the DJs</span>
          <b id="sheet-title">See you on the floor.</b>
          <p>On the night, scan the QR code at the venue to see what the room wants, or to change your answer.</p>
          <div>
            <button className="btn sm" type="button" onClick={done}>
              Back to the event
            </button>
          </div>
        </div>
      ) : (
        <>
          <h2 id="sheet-title" ref={head} tabIndex={-1}>
            Help the DJs <span className="it">set the night</span>
          </h2>
          <p className="taste-ev">
            {e.title} · {e.local.date} · {e.venue.name}
          </p>
          <p className="taste-why">It takes twenty seconds, and we don&apos;t ask for your name. The DJs read every answer before doors open.</p>
          <TasteForm id="ts" slug={e.slug} source="ticket" options={options} initial={initial} onSent={() => setSent(true)} onSkip={done} />
        </>
      )}
    </div>
  );
}
