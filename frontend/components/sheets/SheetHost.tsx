"use client";

// Detail sheet (prototype L536, openSheet/closeSheet L817-818). The provider owns which
// sheet is open and the URL; this renders it, closes on ✕ / dim / Escape, locks page
// scroll and keeps focus inside the card while open.

import { useEffect, useLayoutEffect, useRef } from "react";
import { useSite } from "../site";
import { EventSheet } from "./EventSheet";
import { TalentSheet } from "./TalentSheet";

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([tabindex="-1"]),select,textarea,[tabindex]:not([tabindex="-1"])';

export function SheetHost() {
  const { sheet, closeSheet } = useSite();
  const card = useRef<HTMLDivElement>(null);
  const close = useRef(closeSheet);
  useEffect(() => {
    close.current = closeSheet;
  }, [closeSheet]);

  const open = !!sheet;
  const key = sheet ? `${sheet.type}:${sheet.slug}` : "";

  // Open: lock page scroll, trap Tab, Escape closes. Close: restore scroll and focus.
  // A layout effect, so the opener is captured before the ✕ takes focus (parts.tsx Close).
  useLayoutEffect(() => {
    if (!open) return;
    const back = document.activeElement as HTMLElement | null;
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close.current();
        return;
      }
      if (e.key !== "Tab" || !card.current) return;
      const els = [...card.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((x) => x.offsetParent !== null);
      if (!els.length) return;
      const first = els[0],
        last = els[els.length - 1];
      const inside = card.current.contains(document.activeElement);
      if (e.shiftKey && (document.activeElement === first || !inside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !inside)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      html.style.overflow = prev;
      if (back?.isConnected) back.focus({ preventScroll: true });
    };
  }, [open]);

  // New content (open, or event → talent from the line-up): back to the top.
  useLayoutEffect(() => {
    if (key && card.current) card.current.scrollTop = 0;
  }, [key]);

  return (
    <div className={`sheet${open ? " open" : ""}`}>
      <div className="dim" onClick={closeSheet} />
      <div className="card" ref={card} role="dialog" aria-modal="true" aria-labelledby="sheet-title">
        {sheet?.type === "event" && <EventSheet key={key} slug={sheet.slug} taste={!!sheet.taste} />}
        {sheet?.type === "talent" && <TalentSheet key={key} slug={sheet.slug} />}
      </div>
    </div>
  );
}
