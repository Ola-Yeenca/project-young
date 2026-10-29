// Shared bits of the Privacy, Terms and Legal notice pages. Company details come from Studio's
// Site settings and show only once the team fills them in.

import Link from "next/link";
import type { ReactNode } from "react";
import type { City, Site } from "@/lib/types";

export const UPDATED = "29 October 2026";

/** The company details filled in so far; nothing at all while they're blank. */
export function Company({ site, register = false }: { site: Site | null; register?: boolean }) {
  const email = site?.privacy_email;
  const rows: [string, ReactNode][] = [
    ["Owner", site?.legal_name],
    ["Tax ID (NIF)", site?.tax_id],
    ["Address", site?.legal_address],
    ["Register", register && site?.registry_details],
    ["Email", email && <a href={`mailto:${email}`}>{email}</a>],
  ];
  const filled = rows.filter(([, value]) => value);
  if (!filled.length) return null;
  return (
    <div className="kv">
      {filled.map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <span>{value}</span>
        </div>
      ))}
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
