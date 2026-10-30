import type { Metadata } from "next";
import Link from "next/link";
import { Company, UPDATED } from "@/components/legal";
import { getGlobal } from "@/lib/server";

export const metadata: Metadata = { title: "Legal notice" };

export default async function Page() {
  const { site } = await getGlobal();
  return (
    <section className="view active">
      <div className="wrap blk legal">
        <h2 className="big">Legal notice</h2>
        <p className="mono">Last updated {UPDATED}</p>
        <p>
          House of Young runs this website, fromthehouseofyoung.com. To reach us, use the <Link href="/contact">contact form</Link>. Using the site means you accept
          our <Link href="/terms">terms</Link>. The <Link href="/privacy">privacy policy</Link> explains how we handle personal data.
        </p>
        <Company site={site} register />

        <h3>Intellectual property</h3>
        <p>
          All rights reserved. The House of Young name and logo, the site&apos;s design and text, and its photos, videos and music are protected and belong to us or
          the people who made them. Don&apos;t copy, reuse, scrape or use any of it commercially without our written permission. If something here is yours, or
          you&apos;d like a photo of you taken down, send its link through the <Link href="/contact">contact form</Link> and we&apos;ll remove it.
        </p>

        <h3>Accuracy and liability</h3>
        <p>
          We keep the site as accurate as we can, but it comes as it is, without warranties, and anything on it can change. Organisers can change their events. To
          the extent the law allows, we aren&apos;t liable for any loss from using the site or relying on it, and nothing here limits your rights as a consumer.
        </p>

        <h3>Other sites and ticket sellers</h3>
        <p>
          We link to ticket sellers, social networks and artists&apos; pages. We don&apos;t control them. Each is responsible for its own site, and ticket sellers
          are responsible for their own sales. We&apos;ll remove any link we learn is unlawful.
        </p>

        <h3>Law and changes</h3>
        <p>
          Spanish law governs this notice, and disputes go to the courts of Valencia unless consumer law lets you use the courts where you live. If we change it,
          we&apos;ll update the date at the top.
        </p>
      </div>
    </section>
  );
}
