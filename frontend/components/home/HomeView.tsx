"use client";

import Link from "next/link";
import { Fragment } from "react";
import { Hero } from "./Hero";
import { Calendar, Cities, FloorStrip, Lineup, Marquee } from "./Sections";
import { useSite } from "../site";

/**
 * Prototype section#v-home, in the same order. The hero handles a city switch itself (a record
 * change, like the prototype's render() → setRecord()); the rest is keyed by city so it re-renders.
 */
export function HomeView() {
  const { slug } = useSite();
  return (
    <section className="view active" id="v-home">
      <Hero />
      <Fragment key={slug}>
        <Marquee />
        <Cities />
        <div className="wrap blk">
          <div className="sh" data-rv>
            <h2>
              The <span className="it">calendar</span>
            </h2>
            <Link className="r" href="/events">
              All events →
            </Link>
          </div>
          <Calendar />
        </div>
        <div className="night grain">
          <div className="wrap blk">
            <Lineup home />
          </div>
        </div>
        <div className="wrap blk">
          <div className="sh" data-rv>
            <h2>
              From the <span className="it">floor</span>
            </h2>
            <Link className="r" href="/gallery">
              Gallery →
            </Link>
          </div>
          <FloorStrip />
        </div>
      </Fragment>
    </section>
  );
}
