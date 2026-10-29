"use client";

// Event detail sheet (prototype openEvent, L796-802).

import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import { get } from "@/lib/api";
import { kindLabel, money, priceOf, purchaseUrl, seedOf, soldOf } from "@/lib/format";
import type { EventItem } from "@/lib/types";
import { Img } from "../ui";
import { useSite } from "../site";
import { Close, SheetError } from "./parts";

const STYLES: Record<string, string> = { amapiano: "Amapiano", afrobeats: "Afrobeats", highlife: "Highlife", mixed: "Mixed" };
const styleLabel = (s: string) => STYLES[s] ?? (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");

type Found = { e: EventItem; past: boolean };

export function EventSheet({ slug }: { slug: string }) {
  const { bundles, openSheet } = useSite();

  // Any loaded city first (upcoming, featured, then past); otherwise ask the API.
  const known = ((): Found | null => {
    for (const b of Object.values(bundles)) {
      const e = b.events.find((x) => x.slug === slug) ?? b.featured.find((x) => x.slug === slug);
      if (e) return { e, past: false };
    }
    for (const b of Object.values(bundles)) {
      const e = b.past.find((x) => x.slug === slug);
      if (e) return { e, past: true };
    }
    return null;
  })();

  const [fetched, setFetched] = useState<Found | "error" | null>(null);
  const need = !known;
  useEffect(() => {
    if (!need) return;
    let live = true;
    get<EventItem>(`/events/${encodeURIComponent(slug)}/`)
      .then((e) => live && setFetched({ e, past: new Date(e.starts_at).getTime() < Date.now() }))
      .catch(() => live && setFetched("error"));
    return () => {
      live = false;
    };
  }, [need, slug]);

  const found = known ?? (fetched && fetched !== "error" ? fetched : null);
  if (!found) return <SheetError seed={seedOf(slug)} loading={fetched !== "error"} what="This event is not available." />;

  return <EventCard e={found.e} past={found.past} openTalent={(s) => openSheet("talent", s)} />;
}

function EventCard({ e, past, openTalent }: { e: EventItem; past: boolean; openTalent: (slug: string) => void }) {
  const { bundles } = useSite();
  const checkout = purchaseUrl(e);
  const simulation = e.ticketing_mode === "simulation";
  const sold = soldOf(e) >= 100;
  const price = priceOf(e);
  const tag = e.is_cancelled ? "Cancelled" : past ? "Past" : sold ? "Sold out" : kindLabel(e.kind);
  const album = past ? Object.values(bundles).flatMap((b) => b.albums).find((a) => a.event === e.slug) : undefined;
  const style = e.music_style_label || styleLabel(e.music_style);
  const i = (n: number) => ({ "--i": n }) as React.CSSProperties;

  return (
    <>
      <div className="hero-img">
        <Img src={e.poster} alt={e.poster_alt || e.title} seed={seedOf(e.slug)} w={600} h={750} eager className={e.poster_fit === "contain" ? "contain" : undefined} />
        <Close />
        <div className="ov">
          <span className="tag">{tag}</span>
          <h2 id="sheet-title">{e.title}</h2>
          <span className="m">
            {e.local.date}
            {e.local.time ? ` · ${e.local.time}` : ""} · {e.venue.name}
          </span>
        </div>
      </div>
      <div className="body">
        {past ? (
          <Link className="btn ink" style={i(0)} href={album ? `/gallery/${album.slug}` : "/gallery"}>
            See the photos <span className="ar">→</span>
          </Link>
        ) : (
          <>
            {!e.is_cancelled && checkout && (
              <a className="btn ink" style={i(0)} href={checkout} target={simulation ? undefined : "_blank"} rel="noopener">
                {simulation ? "Get tickets · Nocheva" : sold ? "Join the waitlist" : price === null ? "Buy tickets" : `Buy tickets · ${money(e.currency_symbol, price)}`} <span className="ar">→</span>
              </a>
            )}
            <p className="m" style={i(1)}>
              {simulation ? "Local ticket simulation. No money is collected; test tickets are not valid for entry." : !checkout && !e.is_cancelled ? "Registration is not open for this event yet." : ""}
            </p>
          </>
        )}
        <p style={{ ...i(2), fontFamily: "var(--serif)", fontStyle: "italic", fontSize: "1.3rem", lineHeight: 1.3 }}>{e.caption || "Recap, photos and film from the night."}</p>
        <div className="kv" style={i(3)}>
          {e.lineup.length > 0 && (
            <div>
              <span>Line-up</span>
              <span>
                {e.lineup.map((p, n) => (
                  <Fragment key={n}>
                    {n > 0 && <br />}
                    {p.slug ? (
                      <button type="button" onClick={() => openTalent(p.slug!)} style={{ textAlign: "left", textDecoration: "underline", textDecorationColor: "var(--line-2)", textUnderlineOffset: 3 }}>
                        {p.name}
                      </button>
                    ) : (
                      p.name
                    )}
                  </Fragment>
                ))}
              </span>
            </div>
          )}
          <div>
            <span>Venue</span>
            <span>
              {e.venue.name}, {e.city.name}
            </span>
          </div>
          <div>
            <span>Doors</span>
            <span>{e.local.time || "—"}</span>
          </div>
          {e.bpm ? (
            <div>
              <span>Tempo</span>
              <span>
                {e.bpm} BPM{style ? ` · ${style}` : ""}
              </span>
            </div>
          ) : null}
          <div>
            <span>Tickets</span>
            <span>{past ? "Closed" : simulation ? "Nocheva · local simulation" : checkout ? e.ticket_provider : "Not open"}</span>
          </div>
          {e.age_restriction && (
            <div>
              <span>Age</span>
              <span>{e.age_restriction}</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
