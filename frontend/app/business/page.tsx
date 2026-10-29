import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getGlobal } from "@/lib/server";

export const metadata: Metadata = { title: "Business" };

// Offline until Studio's "Business section live" is switched on.
export default async function Page() {
  const { site } = await getGlobal();
  if (!site?.business_enabled) notFound();
  return (
    <section className="view active" id="v-business">
      <div className="wrap blk">
        <h2 className="big">
          House of Young <span className="it">Business</span>
        </h2>
        <div className="split">
          <div className="about">
            <p>Collaborations and opportunities for businesses and entrepreneurs. Our business services are on their way.</p>
          </div>
          <div>
            <Link className="btn ink mag" href="/contact">
              Get in touch <span className="ar">→</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
