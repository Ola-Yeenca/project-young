"use client";

// Shared bits of the contact and booking forms: field errors, the privacy checkbox,
// the honeypot and the POST state. Markup follows the prototype's form/label style.

import Link from "next/link";
import { useCallback, useState } from "react";
import { post } from "@/lib/api";

export type Errors = Record<string, string>;

/** Props for an input that may carry an error: aria-invalid + a pointer to the message. */
export const errProps = (errors: Errors, id: string, name: string) =>
  errors[name] ? { "aria-invalid": true as const, "aria-describedby": `${id}-${name}-err` } : {};

/** Inline field error, rendered inside the field's label. */
export function Err({ errors, id, name }: { errors: Errors; id: string; name: string }) {
  return errors[name] ? (
    <span className="err" id={`${id}-${name}-err`}>
      {errors[name]}
    </span>
  ) : null;
}

export function Privacy({ errors, id }: { errors: Errors; id: string }) {
  return (
    <>
      <label className="ck">
        <input type="checkbox" name="privacy_accepted" required {...errProps(errors, id, "privacy_accepted")} /> I agree to the{" "}
        <Link href="/privacy">privacy policy</Link>.
      </label>
      <Err errors={errors} id={id} name="privacy_accepted" />
    </>
  );
}

/** Visually hidden, never filled by people. Bots that fill it are rejected by the API. */
export function Honeypot() {
  return (
    <label className="hp" aria-hidden="true">
      Website
      <input name="website" tabIndex={-1} autoComplete="off" />
    </label>
  );
}

/** Errors that belong to no visible field (general, 429, unknown keys). */
export function Fail({ errors, fields }: { errors: Errors; fields: string[] }) {
  const msgs = Object.entries(errors)
    .filter(([k]) => !fields.includes(k))
    .map(([, v]) => v);
  return msgs.length ? (
    <p className="fail" role="alert">
      {msgs.join(" ")}
    </p>
  ) : null;
}

/** POST state for one enquiry form. */
export function useEnquiry(path: string) {
  const [errors, setErrors] = useState<Errors>({});
  const [sending, setSending] = useState(false);
  const [reference, setReference] = useState<string | null>(null);

  const send = useCallback(
    async (body: Record<string, unknown>) => {
      setSending(true);
      setErrors({});
      const r = await post(path, body);
      setSending(false);
      if (r.ok) setReference(r.reference);
      else setErrors(r.errors);
    },
    [path],
  );

  /** Clears a field's error as soon as it is edited. */
  const clear = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    const name = (e.target as HTMLInputElement).name;
    if (name) setErrors((m) => (m[name] ? Object.fromEntries(Object.entries(m).filter(([k]) => k !== name)) : m));
  }, []);

  return { errors, setErrors, sending, reference, send, clear };
}

export const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
