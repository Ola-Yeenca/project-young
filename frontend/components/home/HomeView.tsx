"use client";

import Link from "next/link";
import { Fragment } from "react";
import { Hero } from "./Hero";
import { Calendar, Cities, FloorStrip, Lineup, Marquee } from "./Sections";
import { Closing, Community, Identity, WhatWeDo } from "./Story";
import { useSite } from "../site";

/**
 * Prototype section#v-home, in the same order, with the brief's About-us sections around it.
 * The hero handles a city switch itself (a record change, like the prototype's render() →
 * setRecord()); the rest is keyed by city so it re-renders.
 */
export function HomeView() {
  const { slug } = useSite();
  return (
    <section className="view active" id="v-home">
      <Hero />
      <Fragment key={slug}>
        <Marquee />
        <Identity />
        <WhatWeDo />
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
        <Community />
        <div className="wrap blk" style={{ paddingTop: 0 }}>
          <FloorStrip />
        </div>
        <Closing />
      </Fragment>
    </section>
  );
}
