import type { Metadata } from "next";
import Link from "next/link";
import { UPDATED, ticketSellers } from "@/components/legal";
import { getGlobal } from "@/lib/server";

export const metadata: Metadata = { title: "Terms" };

export default async function Page() {
  const { cities } = await getGlobal();
  return (
    <section className="view active">
      <div className="wrap blk legal">
        <h2 className="big">Terms</h2>
        <p className="mono">Last updated {UPDATED}</p>
        <p>
          By using this website you agree to these terms. See also our <Link href="/privacy">privacy policy</Link> and <Link href="/legal">legal notice</Link>. If we
          change these terms we&rsquo;ll update the date above.
        </p>

        <h3>Using the site</h3>
        <p>
          It&rsquo;s for your own personal, non-commercial use. No scraping, abuse, fake submissions or attempts to break into or overload it. Line-ups, times and
          prices can change; the ticket seller&rsquo;s page has the final word.
        </p>

        <h3 id="tickets">Tickets</h3>
        <p>
          Tickets are sold by {ticketSellers(cities)}, third-party sellers with their own terms, so payments, refunds and transfers go to them. Age, ID and venue rules
          apply on the night, and we may refuse entry to or remove anyone breaking them or the law.
        </p>

        <h3 id="photos">Photos and filming at events</h3>
        <p>
          By attending you accept that you may appear in our photos and videos, on this site, on social media and in our promotion. To have a photo of you removed
          from the gallery, use the <Link href="/contact">contact form</Link>. Gallery downloads are for personal use with credit; nothing commercial without our
          written permission.
        </p>

        <h3>Rights, liability and law</h3>
        <p>
          All rights reserved; see the <Link href="/legal">legal notice</Link>. To the extent the law allows, we aren&rsquo;t liable for any loss from using the site,
          and nothing here limits your rights as a consumer. These terms are governed by Spanish law.
        </p>
      </div>
    </section>
  );
}
