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
          This website, fromthehouseofyoung.com, is owned and run by the company below. These are the owner details required by Spain&rsquo;s Information Society
          Services Act (Law 34/2002, LSSI-CE).
        </p>
        <Company site={site} register />

        <h3>Using this site</h3>
        <p>
          Using the site means you accept our <Link href="/terms">terms</Link>. How we handle personal data is explained in the <Link href="/privacy">privacy policy</Link>.
        </p>

        <h3>Intellectual property</h3>
        <p>
          The House of Young name and logo, the site&rsquo;s design and text, and its photos, videos and music belong to House of Young or are used with their
          owners&rsquo; permission. Please don&rsquo;t copy or reuse them without permission.
        </p>

        <h3>Links</h3>
        <p>
          We link to ticket sellers, social networks and artists&rsquo; pages. We don&rsquo;t control those sites and aren&rsquo;t responsible for their content, and
          we&rsquo;ll remove any link we learn is unlawful.
        </p>
      </div>
    </section>
  );
}
