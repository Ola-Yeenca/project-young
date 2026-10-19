"use client";

// Contact form (prototype L510-519, L729, L853, L865). POSTs to /enquiries/contact/.

import { useEffect, useRef, useState } from "react";
import { useSite } from "../site";
import { Err, Fail, Honeypot, Privacy, errProps, str, useEnquiry } from "./fields";

const REASONS: [string, string][] = [
  ["General enquiry", "general"],
  ["Events", "events"],
  ["Talent", "talent"],
  ["Business collaboration", "business"],
  ["Merchandise", "merchandise"],
  ["Other", "other"],
];
const FIELDS = ["name", "email", "phone", "subject", "message", "privacy_accepted"];
const ID = "c";

export function ContactForm() {
  const { slug } = useSite();
  const [reason, setReason] = useState("general");
  const { errors, sending, reference, send, clear } = useEnquiry("/enquiries/contact/");
  const sent = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reference) sent.current?.focus();
  }, [reference]);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (sending) return;
    const fd = new FormData(e.currentTarget);
    send({
      name: str(fd, "name"),
      email: str(fd, "email"),
      phone: str(fd, "phone"),
      message: str(fd, "message"),
      subject: str(fd, "subject"),
      category: reason,
      city: slug || null,
      privacy_accepted: fd.get("privacy_accepted") === "on",
      website: String(fd.get("website") ?? ""),
    });
  };

  return (
    <div id="cbox" data-rv style={{ "--d": "120ms" } as React.CSSProperties}>
      {reference ? (
        <div className="sent" ref={sent} tabIndex={-1} role="status">
          <span className="mono">Received · {reference}</span>
          <b>Message sent.</b>
          <p>We reply within one working day. A confirmation email goes to the address you gave.</p>
        </div>
      ) : (
        <form id="cform" onSubmit={submit} onInput={clear}>
          <div className="chips" id="reasons">
            {REASONS.map(([label, value]) => (
              <button key={value} type="button" className={value === reason ? "on" : ""} aria-pressed={value === reason} onClick={() => setReason(value)}>
                {label}
              </button>
            ))}
          </div>
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
              Phone
              <input name="phone" type="tel" placeholder="+34 / +234" autoComplete="tel" {...errProps(errors, ID, "phone")} />
              <Err errors={errors} id={ID} name="phone" />
            </label>
            <label>
              Subject
              <input name="subject" required maxLength={160} {...errProps(errors, ID, "subject")} />
              <Err errors={errors} id={ID} name="subject" />
            </label>
          </div>
          <label>
            Message
            <textarea name="message" required {...errProps(errors, ID, "message")} />
            <Err errors={errors} id={ID} name="message" />
          </label>
          <Privacy errors={errors} id={ID} />
          <Honeypot />
          <Fail errors={errors} fields={FIELDS} />
          <div>
            <button className="btn ink mag" type="submit" disabled={sending}>
              {sending ? (
                "Sending…"
              ) : (
                <>
                  Send message <span className="ar">→</span>
                </>
              )}
            </button>
          </div>
          <span className="note">Goes to the HOY inbox. You get a confirmation email.</span>
        </form>
      )}
    </div>
  );
}
