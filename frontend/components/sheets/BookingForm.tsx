"use client";

// Booking enquiry inside the talent sheet (prototype L808-816, GAPS A7, A8).
// POSTs to /enquiries/booking/.

import { useEffect, useRef } from "react";
import { Err, Fail, Honeypot, Privacy, errProps, str, useEnquiry } from "../forms/fields";

const TYPES: [string, string][] = [
  ["Concert / show", "concert"],
  ["Club night", "club"],
  ["Private event", "private"],
  ["Corporate / brand", "corporate"],
  ["Wedding", "wedding"],
  ["Festival", "festival"],
  ["Other", "other"],
];
const AUDIENCE: [string, string][] = [
  ["Under 100", "lt100"],
  ["100 to 300", "100-300"],
  ["300 to 1,000", "300-1000"],
  ["Over 1,000", "gt1000"],
];
const FIELDS = ["client_name", "company", "email", "phone", "event_date", "event_location", "event_type", "expected_audience", "message", "privacy_accepted"];
const ID = "b";

export function BookingForm({ talent, name, style }: { talent: string; name: string; style?: React.CSSProperties }) {
  const { errors, setErrors, sending, reference, send, clear } = useEnquiry("/enquiries/booking/");
  const sent = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reference) sent.current?.focus();
  }, [reference]);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (sending) return;
    const fd = new FormData(e.currentTarget);
    const email = str(fd, "email"),
      phone = str(fd, "phone");
    // Same rule as the API: one way to reply is enough, none is not.
    if (!email && !phone) {
      setErrors({ email: "Give an email address or a phone number so we can reply." });
      e.currentTarget.querySelector<HTMLInputElement>('[name="email"]')?.focus();
      return;
    }
    // No city: the API files the enquiry under the artist's home city.
    send({
      talent,
      client_name: str(fd, "client_name"),
      company: str(fd, "company"),
      email,
      phone,
      event_date: str(fd, "event_date"),
      event_location: str(fd, "event_location"),
      event_type: str(fd, "event_type"),
      expected_audience: str(fd, "expected_audience"),
      message: str(fd, "message"),
      privacy_accepted: fd.get("privacy_accepted") === "on",
      website: String(fd.get("website") ?? ""),
    });
  };

  return (
    <div id="bbox" style={style}>
      {reference ? (
        <div className="sent" ref={sent} tabIndex={-1} role="status">
          <span className="mono">Received · {reference}</span>
          <b>Your enquiry for {name} is in.</b>
          <p>We reply within one working day.</p>
        </div>
      ) : (
        <form id="bform" onSubmit={submit} onInput={clear}>
          <span className="mono">Booking enquiry · {name}</span>
          <div className="f2">
            <label>
              Your name
              <input name="client_name" required autoComplete="name" {...errProps(errors, ID, "client_name")} />
              <Err errors={errors} id={ID} name="client_name" />
            </label>
            <label>
              Company
              <input name="company" autoComplete="organization" {...errProps(errors, ID, "company")} />
              <Err errors={errors} id={ID} name="company" />
            </label>
          </div>
          <div className="f2">
            <label>
              Email
              <input name="email" type="email" autoComplete="email" {...errProps(errors, ID, "email")} />
              <Err errors={errors} id={ID} name="email" />
            </label>
            <label>
              Phone
              <input name="phone" type="tel" autoComplete="tel" {...errProps(errors, ID, "phone")} />
              <Err errors={errors} id={ID} name="phone" />
            </label>
          </div>
          <div className="f2">
            <label>
              Event date
              <input name="event_date" type="date" required {...errProps(errors, ID, "event_date")} />
              <Err errors={errors} id={ID} name="event_date" />
            </label>
            <label>
              Location
              <input name="event_location" placeholder="City, venue" required {...errProps(errors, ID, "event_location")} />
              <Err errors={errors} id={ID} name="event_location" />
            </label>
          </div>
          <div className="f2">
            <label>
              Event type
              <select name="event_type" {...errProps(errors, ID, "event_type")}>
                {TYPES.map(([l, v]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              <Err errors={errors} id={ID} name="event_type" />
            </label>
            <label>
              Audience
              <select name="expected_audience" {...errProps(errors, ID, "expected_audience")}>
                {AUDIENCE.map(([l, v]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              <Err errors={errors} id={ID} name="expected_audience" />
            </label>
          </div>
          <label>
            Anything else
            <textarea name="message" placeholder="Set length, budget range" {...errProps(errors, ID, "message")} />
            <Err errors={errors} id={ID} name="message" />
          </label>
          <Privacy errors={errors} id={ID} />
          <Honeypot />
          <Fail errors={errors} fields={FIELDS} />
          <div>
            <button className="btn ink" type="submit" disabled={sending}>
              {sending ? (
                "Sending…"
              ) : (
                <>
                  Send enquiry <span className="ar">→</span>
                </>
              )}
            </button>
          </div>
          <span className="note">We reply within one working day.</span>
        </form>
      )}
    </div>
  );
}
