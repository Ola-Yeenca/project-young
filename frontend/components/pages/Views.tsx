"use client";

// The pages (prototype L469–522): Events, Talent, Gallery, Shop, Contact. Each view is keyed by
// city so its local state (kind, album, product) resets on a city switch, like render().

import { useEffect, useRef, useState } from "react";
import { useSite } from "../site";
import { Img, Peek } from "../ui";
import { RowsSkeleton } from "../skeleton";
import { Lineup } from "../home/Sections";
import { countUp, Frames, IdxHead, interleave, NoDates, Row, type Rank } from "../home/sections/shared";
import { ContactForm } from "../forms/ContactForm";
import { ContactPortal, EventsPortal, GalleryPortal, ShopPortal, TalentPortal } from "./Portal";
import { kindLabel, pad, seedOf, shipLine } from "@/lib/format";
import type { City, Product } from "@/lib/types";

type CSS = React.CSSProperties;

/* ---------------- /events ---------------- */

function Events() {
  const { bundle, city } = useSite();
  const [kind, setKind] = useState("All");
  const events = bundle?.events ?? [];
  const kinds = ["All", ...new Set(events.map((e) => kindLabel(e.kind)))];
  let k = 0;
  return (
    <div className="wrap blk">
      <div className="sh" data-rv="">
        <h2>
          All <span className="it">dates</span>
        </h2>
        <span className="r">{city ? `Tickets via ${city.ticket_provider}` : ""}</span>
      </div>
      <div className="chips" style={{ marginBottom: "22px" }}>
        {kinds.map((x) => (
          <button key={x} className={x === kind ? "on" : ""} onClick={() => setKind(x)}>
            {x}
          </button>
        ))}
      </div>
      <div className="idx" data-peekwrap="">
        <IdxHead />
        {!bundle ? (
          <RowsSkeleton n={4} />
        ) : events.length ? (
          events.map((e, i) => (kind === "All" || kindLabel(e.kind) === kind ? <Row key={`${kind}-${e.slug}`} e={e} i={i} k={k++} past={false} /> : null))
        ) : (
          <NoDates />
        )}
        <Peek />
      </div>
      {/* No past nights yet: leave the Past block out rather than show an empty list. */}
      {(!bundle || bundle.past.length > 0) && (
        <>
          <div className="sh" style={{ marginTop: "64px" }} data-rv="">
            <h2>Past</h2>
          </div>
          <div className="idx" data-peekwrap="">
            {!bundle ? <RowsSkeleton n={2} /> : bundle.past.map((e, i) => <Row key={e.slug} e={e} i={i} k={i} past />)}
            <Peek />
          </div>
        </>
      )}
    </div>
  );
}

export function EventsView() {
  const { slug } = useSite();
  return (
    <section className="view active" id="v-events" key={slug}>
      <EventsPortal />
      <Events />
    </section>
  );
}

/* ---------------- /talent ---------------- */

export function TalentView() {
  const { slug } = useSite();
  return (
    <section className="view active" id="v-talent" key={slug}>
      <TalentPortal />
      <div className="night grain">
        <div className="wrap blk" id="all-lineup">
          <Lineup home={false} />
        </div>
      </div>
    </section>
  );
}

/* ---------------- /gallery ---------------- */

const SORTS: [Rank | null, string][] = [
  [null, "Latest"],
  ["views", "Most viewed"],
  ["downloads", "Most downloaded"],
];

function Gallery({ initial }: { initial?: string }) {
  const { bundle } = useSite();
  const [sel, setSel] = useState(initial ?? "All");
  const albums = bundle?.albums ?? [];
  const current = albums.find((a) => a.slug === sel);
  const album = current ? sel : "All";
  const [rank, setRank] = useState<Rank | null>(null);
  const all = current ? interleave([current]) : interleave(albums);
  const shots = rank ? [...all].sort((a, b) => b.item[rank] - a.item[rank]) : all;

  // An album slug from the URL that this city doesn't have falls back to All.
  useEffect(() => {
    if (bundle && sel !== "All" && !current) window.history.replaceState(null, "", "/gallery");
  }, [bundle, sel, current]);

  const pick = (s: string) => {
    setSel(s);
    window.history.replaceState(null, "", s === "All" ? "/gallery" : `/gallery/${s}`);
  };
  return (
    <div className="wrap blk">
      <div className="sh" data-rv="">
        <h2>Albums</h2>
        <span className="r">Tap a photo to open it</span>
      </div>
      <div className="chips" style={{ marginBottom: "22px" }}>
        <button className={album === "All" ? "on" : ""} onClick={() => pick("All")}>
          All
        </button>
        {albums.map((a) => (
          <button key={a.slug} className={a.slug === album ? "on" : ""} onClick={() => pick(a.slug)}>
            {a.title}
          </button>
        ))}
      </div>
      <div className="chips rank" style={{ marginBottom: "22px" }} role="group" aria-label="Order photos">
        {SORTS.map(([k, label]) => (
          <button key={label} className={k === rank ? "on" : ""} aria-pressed={k === rank} onClick={() => setRank(k)}>
            {label}
          </button>
        ))}
      </div>
      <div className="strip">
        <Frames shots={shots} prefix={`${album}-${rank ?? "latest"}`} rank={rank ?? undefined} />
      </div>
    </div>
  );
}

export function GalleryView({ album }: { album?: string }) {
  const { slug } = useSite();
  return (
    <section className="view active" id="v-gallery" key={slug}>
      <GalleryPortal />
      {/* Keyed by the album prop: it can arrive after first render (params resolve inside Suspense). */}
      <Gallery key={album ?? ""} initial={album} />
    </section>
  );
}

/* ---------------- /shop ---------------- */

function ProductFocus({ p, i, n, city, step, go }: { p: Product; i: number; n: number; city: City; step: (d: number) => void; go: (i: number) => void }) {
  const price = p.prices.find((x) => x.city === city.slug) ?? p.prices[0];
  const firstSize = Math.min(1, p.variants.length - 1);
  const [size, setSize] = useState(p.variants[firstSize]?.in_stock ? firstSize : p.variants.findIndex((v) => v.in_stock));
  const priceEl = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = priceEl.current;
    if (!el || !price) return;
    el.textContent = "";
    return countUp(el, Number(price.amount), price.currency_symbol);
  }, [price]);
  const src = p.images[0]?.url || p.image;
  return (
    <>
      <div className="focus">
        <div className="l kv swap">
          <div style={{ "--i": 0 } as CSS}>
            <span>Material</span>
            <span>{p.material}</span>
          </div>
          <div style={{ "--i": 1 } as CSS}>
            <span>Fit</span>
            <span>{p.fit}</span>
          </div>
          <div style={{ "--i": 2 } as CSS}>
            <span>Ships</span>
            <span>{city.name}, 3 to 5 days</span>
          </div>
        </div>
        <div className="obj">
          <Img src={src} alt={p.images[0]?.alt || p.name} seed={seedOf(p.slug)} w={700} h={700} />
          <div className="mk">
            <div>
              <b>HOY</b>
              <small>{p.name}</small>
            </div>
          </div>
        </div>
        <div className="r swap">
          <span className="mono" style={{ "--i": 0 } as CSS}>
            N° {pad(i + 1)} / {pad(n)}
          </span>
          <h3 style={{ fontSize: "1.7rem", "--i": 1 } as CSS}>{p.name}</h3>
          <div className="price" style={{ "--i": 2 } as CSS} ref={priceEl}></div>
          <div className="sizes" style={{ "--i": 3 } as CSS}>
            {p.variants.map((v, j) => (
              <button key={v.label} className={j === size ? "on" : ""} disabled={!v.in_stock} onClick={() => setSize(j)}>
                {v.label}
              </button>
            ))}
          </div>
          {price?.checkout_url && (
            <a className="btn ink mag" style={{ "--i": 4 } as CSS} href={price.checkout_url} target="_blank" rel="noopener">
              Buy <span className="ar">↗</span>
            </a>
          )}
        </div>
      </div>
      <div className="hero-foot" style={{ padding: "34px 0 0" }}>
        <p className="cap">{p.description}</p>
        <div className="pager">
          <button className="arrow mag" aria-label="Previous product" onClick={() => step(-1)}>
            ←
          </button>
          <div className="dots hold">
            {Array.from({ length: n }, (_, j) => (
              <button key={j} className={j === i ? "on" : ""} aria-label={`Product ${j + 1}`} onClick={() => go(j)}></button>
            ))}
          </div>
          <button className="arrow mag" aria-label="Next product" onClick={() => step(1)}>
            →
          </button>
        </div>
      </div>
    </>
  );
}

function Shop() {
  const { bundle, city } = useSite();
  const [prod, setProd] = useState(0);
  const products = bundle?.products ?? [];
  const n = products.length;
  const p = products[Math.min(prod, n - 1)];
  // Prototype renderShop() rebuilds everything on a product change, so the swap/pop animations replay.
  return (
    <div className="wrap blk" id="shop" key={prod}>
      <div className="sh" data-rv="">
        <h2>
          The <span className="it">merch</span>
        </h2>
        <span className="r">{city ? shipLine(city) : ""}</span>
      </div>
      {p && city ? (
        <ProductFocus p={p} i={prod} n={n} city={city} step={(d) => setProd((prod + d + n) % n)} go={setProd} />
      ) : bundle ? (
        <p className="mono">Merch drops soon</p>
      ) : null}
    </div>
  );
}

export function ShopView() {
  const { slug } = useSite();
  return (
    <section className="view active" id="v-shop" key={slug}>
      <ShopPortal />
      <Shop />
    </section>
  );
}

/* ---------------- /contact ---------------- */

export function ContactView() {
  const { global, city } = useSite();
  const wa = city?.whatsapp_number;
  // Not keyed by city: the form keeps a half-written message and the clocks glide on a switch.
  return (
    <section className="view active" id="v-contact">
      <ContactPortal />
      <div className="wrap blk">
        <div className="split">
          <div className="about" data-rv="">
            <p>Questions about an event, booking an act or working with us? Send a message and the team will get back to you. Quick answers are below the form.</p>
            <div id="wa">
              {wa && (
                <a className="wa" href={`https://wa.me/${wa.replace(/\D/g, "")}`} target="_blank" rel="noopener">
                  <i></i>WhatsApp {city.name} · {wa}
                </a>
              )}
            </div>
          </div>
          <ContactForm />
        </div>
      </div>
      {global.faqs.length > 0 && (
        <div className="wrap blk" id="faqs" style={{ paddingTop: 0 }}>
          <div className="sh" data-rv="">
            <h2>
              Quick <span className="it">answers</span>
            </h2>
          </div>
          <div className="faq" data-rv="">
            {global.faqs.map((f) => (
              <details key={f.question}>
                <summary>{f.question}</summary>
                <p>{f.answer}</p>
              </details>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
