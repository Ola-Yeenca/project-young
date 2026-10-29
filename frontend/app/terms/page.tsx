import type { Metadata } from "next";
import Link from "next/link";
import { ContactUs, UPDATED, ticketSellers } from "@/components/legal";
import { getGlobal } from "@/lib/server";

export const metadata: Metadata = { title: "Terms" };

export default async function Page() {
  const { site, cities } = await getGlobal();
  return (
    <section className="view active">
      <div className="wrap blk legal">
        <h2 className="big">Terms</h2>
        <p className="mono">Last updated {UPDATED}</p>
        <p>
          These terms cover your use of this website. By using it you agree to them. The site is run by {site?.legal_name || "House of Young"}; the company details
          are in the <Link href="/legal">legal notice</Link>, and how we handle personal data is in the <Link href="/privacy">privacy policy</Link>.
        </p>

        <h3>Using the site</h3>
        <p>
          You can browse the site, share links to it and download gallery photos for your own use. We keep event details, line-ups, times and prices as accurate as we
          can, but they can change. The ticket seller&rsquo;s page has the final word on prices and availability.
        </p>

        <h3 id="tickets">Tickets</h3>
        <p>
          Tickets for House of Young events are sold by third-party ticket sellers: {ticketSellers(cities)}. Buying a ticket is covered by the seller&rsquo;s own
          terms, including payment, refunds and transfers, so questions about an order go to them. Questions about the event itself come to us. Entry conditions such
          as age limits, ID checks and venue rules apply on the night.
        </p>

        <h3 id="photos">Photos and filming at events</h3>
        <p>
          We photograph and film our events. By coming, you understand that you may appear in photos or videos we publish in the gallery on this site, on our social
          media and in our promotion. If you&rsquo;d like a photo of you removed from the gallery, send us its link and we&rsquo;ll take it down. To reach us,{" "}
          <ContactUs site={site} />.
        </p>
        <p>Gallery downloads are for personal use. Credit House of Young when you share them, and ask us before using them for anything commercial.</p>

        <h3>Acceptable use</h3>
        <p>
          Don&rsquo;t misuse the site. That means no attempts to break into it, overload it, scrape it at scale or get around its security, no spam or false details in
          the forms, and nothing unlawful, abusive or hateful in messages or song requests. We may ignore or delete anything sent that breaks these rules.
        </p>

        <h3>Intellectual property</h3>
        <p>
          The House of Young name and logo, the site&rsquo;s design and text, and the photos, videos and music on it belong to House of Young or to the artists and
          photographers who made them. Apart from sharing links and personal use of gallery downloads, please don&rsquo;t copy or reuse them without permission.
        </p>

        <h3>Our responsibility</h3>
        <p>
          We work to keep the site available and correct but can&rsquo;t promise it will always be. We link to other sites, such as ticket sellers and social media,
          and aren&rsquo;t responsible for their content. Nothing in these terms limits the rights you have as a consumer.
        </p>

        <h3>Law</h3>
        <p>
          These terms are governed by Spanish law. If you&rsquo;re a consumer you also keep the protection of the laws and courts of the country where you live.
          Questions about these terms? Use the <Link href="/contact">contact form</Link>.
        </p>
      </div>
    </section>
  );
}
