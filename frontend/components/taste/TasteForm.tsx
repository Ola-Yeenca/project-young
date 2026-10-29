"use client";

// The crowd taste questions, shared by the after-tickets step and the /tonight QR page.

import Link from "next/link";
import { useState } from "react";
import { MAX_GENRES, sendTaste, type TasteAnswer, type TasteOption, type TasteSource, type TasteSummary } from "@/lib/taste";
import { Err, Fail, Honeypot, errProps, str, type Errors } from "../forms/fields";
import "./taste.css";

const FIELDS = ["genres", "artist", "song"];

export function TasteForm({
  id,
  slug,
  source,
  options,
  initial,
  onSent,
  onSkip,
  skipLabel = "Skip",
}: {
  id: string;
  slug: string;
  source: TasteSource;
  /** null while loading */
  options: TasteOption[] | null;
  initial: TasteAnswer | null;
  onSent: (summary: TasteSummary) => void;
  onSkip: () => void;
  skipLabel?: string;
}) {
  const [genres, setGenres] = useState<string[]>(initial?.genres ?? []);
  const [errors, setErrors] = useState<Errors>({});
  const [sending, setSending] = useState(false);
  const full = genres.length >= MAX_GENRES;

  const drop = (name: string) => setErrors((m) => (m[name] || m.__all__ ? Object.fromEntries(Object.entries(m).filter(([k]) => k !== name && k !== "__all__")) : m));
  const toggle = (slug: string) => {
    drop("genres");
    setGenres((xs) => (xs.includes(slug) ? xs.filter((x) => x !== slug) : xs.length < MAX_GENRES ? [...xs, slug] : xs));
  };

  const submit = async (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    if (sending) return;
    const fd = new FormData(ev.currentTarget);
    const answer = { genres, artist: str(fd, "artist"), song: str(fd, "song") };
    if (!answer.genres.length && !answer.artist && !answer.song) {
      setErrors({ __all__: "Pick a genre, or tell us an artist or a song." });
      return;
    }
    setSending(true);
    setErrors({});
    const r = await sendTaste(slug, source, answer, String(fd.get("website") ?? ""));
    setSending(false);
    if (r.ok) onSent(r.summary);
    else setErrors(r.errors);
  };

  return (
    <form className="taste-form" onSubmit={submit} onInput={(e) => drop((e.target as HTMLInputElement).name)} noValidate>
      {options?.length !== 0 && (
        <fieldset className="pick" aria-describedby={errors.genres ? `${id}-genres-err` : undefined}>
          <legend>
            Genres you want tonight <span className="taste-n">{`${genres.length}/${MAX_GENRES}`}</span>
          </legend>
          <div className="chips">
            {options
              ? options.map((o) => {
                  const on = genres.includes(o.slug);
                  return (
                    <button key={o.slug} type="button" className={on ? "on" : ""} aria-pressed={on} disabled={full && !on} onClick={() => toggle(o.slug)}>
                      {o.name}
                    </button>
                  );
                })
              : [0, 1, 2, 3, 4].map((n) => <span key={n} className="sk taste-sk" aria-hidden="true"></span>)}
          </div>
          <Err errors={errors} id={id} name="genres" />
        </fieldset>
      )}
      <label>
        Favourite artist
        <input name="artist" maxLength={80} defaultValue={initial?.artist} autoComplete="off" enterKeyHint="next" {...errProps(errors, id, "artist")} />
        <Err errors={errors} id={id} name="artist" />
      </label>
      <label>
        One song you want to hear
        <input name="song" maxLength={120} defaultValue={initial?.song} autoComplete="off" placeholder="Artist – title" enterKeyHint="send" {...errProps(errors, id, "song")} />
        <Err errors={errors} id={id} name="song" />
      </label>
      <Honeypot />
      <Fail errors={errors} fields={FIELDS} />
      <div className="taste-acts">
        <button className="btn ink mag" type="submit" disabled={sending}>
          {sending ? (
            "Sending…"
          ) : (
            <>
              Send to the DJs <span className="ar">→</span>
            </>
          )}
        </button>
        <button className="btn" type="button" onClick={onSkip}>
          {skipLabel}
        </button>
      </div>
      <span className="note">
        Anonymous: no name, no email. The DJs see the genres, artists and songs; the room sees genre shares only. <Link href="/privacy">Privacy</Link>
      </span>
    </form>
  );
}
