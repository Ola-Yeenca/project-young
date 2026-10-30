"use client";

// The page behind the venue QR code: the taste questions, then the room's live genre shares.

import { useEffect, useRef, useState } from "react";
import { getTaste, useMine, type TasteSummary } from "@/lib/taste";
import type { EventItem } from "@/lib/types";
import { TasteForm } from "./TasteForm";

const POLL = 20000;

export function Tonight({ e }: { e: EventItem }) {
  const [summary, setSummary] = useState<TasteSummary | null>(null);
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState<"ask" | "room" | null>(null);
  const answered = useMine(e.slug);
  const roomHead = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    let live = true;
    const load = () => {
      if (document.hidden) return;
      getTaste(e.slug)
        .then((s) => {
          if (!live) return;
          setSummary(s);
          setFailed(false);
        })
        .catch(() => live && setFailed(true));
    };
    load();
    const t = setInterval(load, POLL);
    document.addEventListener("visibilitychange", load);
    return () => {
      live = false;
      clearInterval(t);
      document.removeEventListener("visibilitychange", load);
    };
  }, [e.slug]);

  const stage = summary && !summary.open ? "room" : (view ?? (answered === undefined ? null : answered ? "room" : "ask"));
  const toRoom = (s?: TasteSummary) => {
    if (s) setSummary(s);
    setView("room");
    requestAnimationFrame(() => roomHead.current?.focus());
  };

  return (
    <section className="view active">
      <div className="wrap tn">
        <div className="tn-head">
          <span className="mono tn-kick">
            <i></i>
            {e.local.date} · {e.city.name}
          </span>
          <h1 className="tn-title">{e.title}</h1>
          <p className="tn-meta">
            {e.venue.name}
            {e.local.time ? ` · doors ${e.local.time}` : ""}
          </p>
        </div>
        {!summary ? (
          failed ? (
            <div className="tn-card" role="alert">
              <p>We couldn&apos;t reach the room. Check your connection.</p>
              <div>
                <button className="btn" type="button" onClick={() => location.reload()}>
                  Try again
                </button>
              </div>
            </div>
          ) : (
            <div className="tn-card" aria-busy="true">
              <span className="sk taste-line"></span>
              <span className="sk taste-line short"></span>
            </div>
          )
        ) : stage === "ask" ? (
          <div className="tn-card">
            <h2>
              Help the DJs <span className="it">set the night</span>
            </h2>
            <p className="tn-why">Pick up to three genres, name an artist you love and ask for one song. We don&apos;t need your name.</p>
            <TasteForm
              id="tn"
              slug={e.slug}
              source="qr"
              options={summary.options}
              initial={answered ?? null}
              onSent={toRoom}
              onSkip={() => toRoom()}
              skipLabel="Just show the room"
            />
          </div>
        ) : (
          <div className="room">
            <div className="room-h">
              <h2 ref={roomHead} tabIndex={-1}>
                The room <span className="it">right now</span>
              </h2>
              <span className="mono">
                <i></i>
                {summary.total} {summary.total === 1 ? "answer" : "answers"}
              </span>
            </div>
            {summary.genres.length ? (
              <ol className="room-bars">
                {summary.genres.map((g) => (
                  <li key={g.slug}>
                    <span className="n">{g.name}</span>
                    <b>{g.percent}%</b>
                    <span className="t">
                      <i style={{ width: `${g.percent}%` }}></i>
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p>Nobody has picked a genre yet. Be the first.</p>
            )}
            <p className="note">Each bar is the share of answers that picked the genre. It updates every 20 seconds.</p>
            {summary.open ? (
              <div>
                <button className="btn" type="button" onClick={() => setView("ask")}>
                  {answered ? "Change my answer" : "Add my answer"}
                </button>
              </div>
            ) : (
              <p className="note">Answers for this night have closed.</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
