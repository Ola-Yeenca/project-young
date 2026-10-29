"use client";

import { useEffect } from "react";
import { useSite } from "../site";

/** Opens the detail sheet on a direct load of /events/:slug or /talent/:slug. */
export function AdoptSheet({ type, slug }: { type: "event" | "talent"; slug: string }) {
  const { adoptSheet } = useSite();
  useEffect(() => adoptSheet(type, slug), [adoptSheet, type, slug]);
  return null;
}
