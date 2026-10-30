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
          change these terms we&apos;ll update the date above.
        </p>

        <h3>Using the site</h3>
        <p>
          It&apos;s for your own personal, non-commercial use. Don&apos;t scrape or abuse it, send fake submissions or try to break into or overload it. Line-ups,
          times and prices can change, and the ticket seller&apos;s page has the final word.
        </p>

        <h3 id="tickets">Tickets</h3>
        <p>
          Tickets are sold by {ticketSellers(cities)}, third-party sellers with their own terms, so payments, refunds and transfers go to them. Age, ID and venue rules
          apply on the night, and we may refuse entry to or remove anyone breaking them or the law.
        </p>

        <h3 id="photos">Photos and filming at events</h3>
        <p>
          By attending you accept that you may appear in our photos and videos, on this site, on social media and in our promotion. To have a photo of you removed
          from the gallery, use the <Link href="/contact">contact form</Link>. Gallery downloads are for personal use with credit. Commercial use needs our written
          permission.
        </p>

        <h3>Rights, liability and law</h3>
        <p>
          All rights reserved, as set out in the <Link href="/legal">legal notice</Link>. To the extent the law allows, we aren&apos;t liable for any loss from using
          the site, and nothing here limits your rights as a consumer. Spanish law governs these terms.
        </p>
      </div>
    </section>
  );
}
