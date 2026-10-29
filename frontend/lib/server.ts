import "server-only";
import { cacheLife } from "next/cache";
import { get, loadCity, loadGlobal } from "./api";
import type { EventItem, TalentDetail } from "./types";

// Cached server reads. Content changes a few times a week; a minute of staleness is fine.

export async function getGlobal() {
  "use cache";
  cacheLife("minutes");
  return loadGlobal();
}

export async function getCity(slug: string) {
  "use cache";
  cacheLife("minutes");
  return loadCity(slug);
}

export async function getEvent(slug: string): Promise<EventItem | null> {
  "use cache";
  cacheLife("minutes");
  return get<EventItem>(`/events/${encodeURIComponent(slug)}/`).catch(() => null);
}

export async function getTalent(slug: string): Promise<TalentDetail | null> {
  "use cache";
  cacheLife("minutes");
  return get<TalentDetail>(`/talent/${encodeURIComponent(slug)}/`).catch(() => null);
}
