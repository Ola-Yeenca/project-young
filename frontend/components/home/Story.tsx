"use client";

// The brief's About-us content: a short identity block, what we do, the community signup and
// the closing call to action on the homepage, and the full story on /about. The copy comes
// from Studio's site settings.

import Link from "next/link";
import { useSite } from "../site";
import { MOTTO } from "../shell";
import { JoinForm } from "../forms/JoinForm";
import { FloorStrip } from "./Sections";
import { StoryPortal } from "../pages/Portal";

type CSS = React.CSSProperties;

/** Studio text to paragraphs: a blank line starts a new one. */
export function Paras({ text }: { text: string | undefined }) {
  return (text ?? "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p, i) => <p key={i}>{p}</p>);
}

/** The homepage's short version: motto, one-line intro, and the way to the full story. */
export function Identity() {
  const { global } = useSite();
  const site = global.site;
  return (
    <div className="wrap blk" id="identity">
      <span className="mono" data-rv="">
        House of Young · Since 2022
      </span>
      <h2 className="big" data-rv="" style={{ marginTop: "18px" }}>
        House of Young. <span className="it">{site?.tagline || MOTTO}</span>
      </h2>
      {site?.intro && (
        <div className="about lead" data-rv="">
          <Paras text={site.intro} />
        </div>
      )}
      <div className="ctas" data-rv="">
        <Link className="btn" href="/about">
          Our story <span className="ar">→</span>
        </Link>
      </div>
    </div>
  );
}

/** /about: the full story, vision and community text from Studio. */
export function AboutView() {
  const { global, slug } = useSite();
  const site = global.site;
  return (
    <section className="view active" id="v-about">
      <StoryPortal />
      {site?.intro && (
        <div className="wrap blk">
          <span className="mono" data-rv="">
            Who we are
          </span>
          <p className="lit">
            <span>{site.intro.replace(/\s*\n\s*/g, " ")}</span>
          </p>
        </div>
      )}
      <div className="wrap blk" style={{ paddingTop: 0 }}>
        <div className="split">
          <div className="about" data-rv="">
            <span className="mono">About House of Young</span>
            <Paras text={site?.about} />
          </div>
          <div className="about" data-rv="" style={{ "--d": "120ms" } as CSS}>
            <span className="mono">Our vision</span>
            <Paras text={site?.vision} />
          </div>
        </div>
      </div>
      <div className="wrap blk" style={{ paddingTop: 0 }} key={slug}>
        <FloorStrip />
      </div>
      {site?.community && (
        <div className="wrap blk" style={{ paddingTop: 0 }}>
          <div className="sh" data-rv="">
            <h2>
              Our <span className="it">community</span>
            </h2>
            <Link className="r" href="/#join">
              Join →
            </Link>
          </div>
          <div className="about" data-rv="">
            <Paras text={site.community} />
          </div>
        </div>
      )}
      <Closing />
    </section>
  );
}

export function Community() {
  const { global } = useSite();
  const lead = (global.site?.community ?? "").split(/\n\s*\n/)[0]?.trim();
  return (
    <div className="wrap blk" id="join">
      <div className="sh" data-rv="">
        <h2>
          Join the <span className="it">community</span>
        </h2>
        <Link className="r" href="/gallery">
          Gallery →
        </Link>
      </div>
      <div className="split">
        <div className="about" data-rv="">
          {lead && <p>{lead}</p>}
          <p>Sign up to hear about events, ticket drops and opportunities before anyone else, by email or WhatsApp.</p>
        </div>
        <div data-rv="" style={{ "--d": "120ms" } as CSS}>
          <JoinForm />
        </div>
      </div>
    </div>
  );
}

const DOES: { title: string; text: string; href: string; cta: string; business?: true }[] = [
  { title: "Events", text: "Creating, organising and promoting experiences that bring people together.", href: "/events", cta: "Explore events" },
  { title: "Talent", text: "Supporting and promoting artists and creative professionals.", href: "/talent", cta: "Discover talent" },
  { title: "Business", text: "Developing collaborations and opportunities for businesses and entrepreneurs.", href: "/business", cta: "Find out more", business: true },
  { title: "Merchandise", text: "Building a stronger connection with our community through HOY-branded products.", href: "/shop", cta: "Visit the shop" },
];

export function WhatWeDo() {
  const { global } = useSite();
  const business = !!global.site?.business_enabled;
  return (
    <div className="wrap blk" style={{ paddingTop: 0 }}>
      <div className="sh" data-rv="">
        <h2>
          What we <span className="it">do</span>
        </h2>
      </div>
      <div className="wwd">
        {DOES.filter((d) => business || !d.business).map((d, i) => (
          <Link key={d.href} className="cityc on" href={d.href} data-rv="" style={{ "--d": `${i * 80}ms` } as CSS}>
            <h3>{d.title}</h3>
            <span className="nx">{d.text}</span>
            <span className="mono">
              {d.cta} <span aria-hidden="true">→</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function Closing() {
  return (
    <div className="wrap blk" id="cta">
      <h2 className="big" data-rv="">
        Be part of the <span className="it">vision</span>
      </h2>
      <div className="about lead" data-rv="">
        <p>Whether you’re looking for your next experience, exploring creative opportunities or interested in collaborating, there’s a place for you at House of Young.</p>
      </div>
      <div className="ctas" data-rv="">
        <Link className="btn ink mag" href="/events">
          Explore events <span className="ar">→</span>
        </Link>
        <Link className="btn" href="/talent">
          Discover talent
        </Link>
        <Link className="btn" href="/contact">
          Contact us
        </Link>
      </div>
    </div>
  );
}
