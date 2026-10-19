"use client";

import { useEffect, useRef } from "react";
import { FieldCanvas } from "../ui";
import { useSite } from "../site";

/**
 * The ✕ on the sheet hero (rotates on hover via .hero-img .x). Takes focus when the sheet
 * opens or its content is replaced, unless focus is already inside the card.
 */
export function Close() {
  const { closeSheet } = useSite();
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const card = ref.current?.closest(".card");
    if (card && !card.contains(document.activeElement)) // focusVisible: false — move focus for keyboard and screen-reader users without painting the
    // ring on open (the prototype shows none); Tab from here shows it as usual.
    ref.current!.focus({ preventScroll: true, focusVisible: false } as FocusOptions);
  }, []);
  return (
    <button ref={ref} className="x" type="button" data-close aria-label="Close" onClick={closeSheet}>
      ✕
    </button>
  );
}

/** Hero while the detail is loading, or when it can't be found. */
export function SheetError({ seed, loading, what }: { seed: number; loading: boolean; what: string }) {
  return (
    <div className="hero-img">
      <FieldCanvas seed={seed} w={600} h={750} />
      <Close />
      <div className="ov">{!loading && <h2 id="sheet-title">{what}</h2>}</div>
    </div>
  );
}
