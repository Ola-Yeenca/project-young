"use client";

// Talent sheet (prototype openTalent, L803-816). The hero shows straight away from the
// roster list; the body fills in when /talent/:slug/ arrives.

import { useEffect, useState } from "react";
import { get } from "@/lib/api";
import { seedOf } from "@/lib/format";
import type { Talent, TalentDetail } from "@/lib/types";
import { Img } from "../ui";
import { useSite } from "../site";
import { BookingForm } from "./BookingForm";
import { Close, SheetError } from "./parts";

export function TalentSheet({ slug }: { slug: string }) {
  const { bundles } = useSite();
  const listed = ((): Talent | null => {
    for (const b of Object.values(bundles)) {
      const t = b.talent.find((x) => x.slug === slug);
      if (t) return t;
    }
    return null;
  })();

  const [detail, setDetail] = useState<TalentDetail | "error" | null>(null);
  useEffect(() => {
    let live = true;
    get<TalentDetail>(`/talent/${encodeURIComponent(slug)}/`)
      .then((t) => live && setDetail(t))
      .catch(() => live && setDetail("error"));
    return () => {
      live = false;
    };
  }, [slug]);

  const d = detail && detail !== "error" ? detail : null;
  const t: Talent | null = d ?? listed;
  if (!t) return <SheetError seed={seedOf(slug)} loading={detail === null} what="This profile is not available." />;

  const i = (n: number) => ({ "--i": n }) as React.CSSProperties;
  return (
    <>
      <div className="hero-img">
        <Img src={t.photo} alt={t.name} seed={seedOf(t.slug)} w={600} h={750} eager />
        <Close />
        <div className="ov">
          <span className="tag">{t.group === "DJs" ? "DJ" : t.group}</span>
          <h2 id="sheet-title">{t.name}</h2>
          <span className="m">
            {t.genre ? `${t.genre} · ` : ""}
            {t.city.name}
          </span>
        </div>
      </div>
      <div className="body">
        {d && (
          <>
            {d.bio && <p style={{ ...i(0), color: "var(--ink-2)", fontSize: "1.02rem" }}>{d.bio}</p>}
            <div className="kv" style={i(1)}>
              {d.previous_work.length > 0 && (
                <div>
                  <span>Previous</span>
                  <span>{d.previous_work.join(" · ")}</span>
                </div>
              )}
              <div>
                <span>Based</span>
                <span>{d.travels ? `${d.city.name}, travels` : d.city.name}</span>
              </div>
              <div>
                <span>Reply</span>
                <span>Within one working day</span>
              </div>
            </div>
            {d.links.length > 0 && (
              <div className="links" style={i(2)}>
                {d.links.map((l) => (
                  <a key={l.url + l.label} href={l.url} target="_blank" rel="noopener">
                    {l.label}
                  </a>
                ))}
              </div>
            )}
            {d.booking_available ? (
              <BookingForm talent={d.slug} name={d.name} style={i(3)} />
            ) : (
              <p className="note" style={i(3)}>
                Not taking bookings right now.
              </p>
            )}
          </>
        )}
      </div>
    </>
  );
}
