"use client";

// "Join the community" signup. POSTs to /community/. Consent is its own unticked box, so
// marketing messages are never bundled with accepting the privacy policy.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSite } from "../site";
import { Err, Fail, Honeypot, errProps, str, useEnquiry } from "./fields";

const INTERESTS: [string, string][] = [
  ["Events", "events"],
  ["Talent opportunities", "talent"],
  ["Business collaboration", "business"],
  ["Merch drops", "merch"],
];
const CHANNELS: [string, string][] = [
  ["Email", "email"],
  ["WhatsApp", "whatsapp"],
  ["Both", "both"],
];
const FIELDS = ["name", "email", "phone", "instagram", "consent"];
const ID = "j";

const handleOf = (url: string) => url.replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/.*$/, "");

export function JoinForm() {
  const { slug, city, cities, global } = useSite();
  const [where, setWhere] = useState(slug);
  const [interests, setInterests] = useState<string[]>(["events"]);
  const [channel, setChannel] = useState("email");
  const { errors, sending, done, send, clear } = useEnquiry("/community/");
  const sent = useRef<HTMLDivElement>(null);
  const ig = city?.instagram_url || global.site?.instagram_url;

  useEffect(() => {
    if (done) sent.current?.focus();
  }, [done]);

  const toggle = (v: string) => setInterests((xs) => (xs.includes(v) ? xs.filter((x) => x !== v) : [...xs, v]));

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (sending) return;
    const fd = new FormData(e.currentTarget);
    send({
      name: str(fd, "name"),
      email: str(fd, "email"),
      phone: str(fd, "phone"),
      instagram: str(fd, "instagram"),
      city: where || null,
      channel,
      interests,
      consent: fd.get("consent") === "on",
      website: String(fd.get("website") ?? ""),
    });
  };

  if (done)
    return (
      <div className="sent" ref={sent} tabIndex={-1} role="status">
        <span className="mono">Welcome to the family</span>
        <b>You’re in.</b>
        <p>You’ll hear about new events, ticket drops and opportunities first.</p>
        {ig && (
          <div>
            <a className="btn ink mag" href={ig} target="_blank" rel="noopener">
              Follow @{handleOf(ig)} on Instagram <span className="ar">↗</span>
            </a>
          </div>
        )}
      </div>
    );

  return (
    <form id="jform" onSubmit={submit} onInput={clear}>
      <div className="f2">
        <label>
          Name
          <input name="name" required autoComplete="name" {...errProps(errors, ID, "name")} />
          <Err errors={errors} id={ID} name="name" />
        </label>
        <label>
          Email
          <input name="email" type="email" required autoComplete="email" {...errProps(errors, ID, "email")} />
          <Err errors={errors} id={ID} name="email" />
        </label>
      </div>
      <div className="f2">
        <label>
          Phone / WhatsApp
          <input name="phone" type="tel" placeholder="+34 / +234" autoComplete="tel" required={channel !== "email"} {...errProps(errors, ID, "phone")} />
          <Err errors={errors} id={ID} name="phone" />
        </label>
        <label>
          Instagram
          <input name="instagram" placeholder="@yourhandle" autoCapitalize="none" autoCorrect="off" {...errProps(errors, ID, "instagram")} />
          <Err errors={errors} id={ID} name="instagram" />
        </label>
      </div>
      <fieldset className="pick">
        <legend>Your city</legend>
        <div className="chips">
          {[...cities.map((c) => [c.name, c.slug] as [string, string]), ["Elsewhere", ""] as [string, string]].map(([label, value]) => (
            <button key={label} type="button" className={value === where ? "on" : ""} aria-pressed={value === where} onClick={() => setWhere(value)}>
              {label}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="pick">
        <legend>Keep me posted on</legend>
        <div className="chips">
          {INTERESTS.map(([label, value]) => (
            <button key={value} type="button" className={interests.includes(value) ? "on" : ""} aria-pressed={interests.includes(value)} onClick={() => toggle(value)}>
              {label}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="pick">
        <legend>Reach me by</legend>
        <div className="chips">
          {CHANNELS.map(([label, value]) => (
            <button key={value} type="button" className={value === channel ? "on" : ""} aria-pressed={value === channel} onClick={() => setChannel(value)}>
              {label}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="ck">
        <input type="checkbox" name="consent" required {...errProps(errors, ID, "consent")} />
        <span>
          Yes, House of Young can send me news and updates the way I chose above. I can unsubscribe any time. See the <Link href="/privacy">privacy policy</Link>.
        </span>
      </label>
      <Err errors={errors} id={ID} name="consent" />
      <Honeypot />
      <Fail errors={errors} fields={FIELDS} />
      <div>
        <button className="btn ink mag" type="submit" disabled={sending}>
          {sending ? (
            "Joining…"
          ) : (
            <>
              Join the community <span className="ar">→</span>
            </>
          )}
        </button>
      </div>
      {ig && (
        <span className="note">
          And follow us on Instagram,{" "}
          <a href={ig} target="_blank" rel="noopener">
            @{handleOf(ig)}
          </a>
          , for the latest drops and behind the scenes.
        </span>
      )}
    </form>
  );
}
