// Shared bits of the Privacy, Terms and Legal notice pages. Company details come from Studio's
// Site settings, so the pages read "Details to follow" until the team fills them in.

import Link from "next/link";
import type { City, Site } from "@/lib/types";

export const UPDATED = "29 October 2026";

export function Detail({ value, href }: { value?: string; href?: string }) {
  if (!value) return <em className="tbc">Details to follow</em>;
  return href ? <a href={href}>{value}</a> : <>{value}</>;
}

export function Company({ site, register = false }: { site: Site | null; register?: boolean }) {
  const email = site?.privacy_email;
  return (
    <div className="kv">
      <div>
        <span>Owner</span>
        <span>
          <Detail value={site?.legal_name} />
        </span>
      </div>
      <div>
        <span>Tax ID (NIF)</span>
        <span>
          <Detail value={site?.tax_id} />
        </span>
      </div>
      <div>
        <span>Address</span>
        <span>
          <Detail value={site?.legal_address} />
        </span>
      </div>
      {register && (
        <div>
          <span>Register</span>
          <span>
            <Detail value={site?.registry_details} />
          </span>
        </div>
      )}
      <div>
        <span>Email</span>
        <span>
          <Detail value={email} href={email ? `mailto:${email}` : undefined} />
        </span>
      </div>
      <div>
        <span>Contact form</span>
        <span>
          <Link href="/contact">fromthehouseofyoung.com/contact</Link>
        </span>
      </div>
    </div>
  );
}

/** How to reach us about privacy: the privacy email once it's set, the contact form until then. */
export function ContactUs({ site }: { site: Site | null }) {
  const email = site?.privacy_email;
  return email ? (
    <>
      email <a href={`mailto:${email}`}>{email}</a> or use the <Link href="/contact">contact form</Link>
    </>
  ) : (
    <>
      use the <Link href="/contact">contact form</Link>
    </>
  );
}

/** Each city's ticket partner, as a phrase: "Fourvenues and Tix.africa". */
export function ticketSellers(cities: City[]) {
  const names = [...new Set(cities.map((c) => c.ticket_provider.trim()).filter(Boolean))];
  if (names.length < 2) return names[0] ?? "our ticket partners";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
