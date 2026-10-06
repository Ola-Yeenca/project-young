import type { Metadata } from "next";
import { getEvent } from "@/lib/server";
import { EventsView } from "@/components/pages/Views";
import { AdoptSheet } from "@/components/sheets/Adopt";

export async function generateMetadata({ params }: PageProps<"/events/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const e = await getEvent(slug);
  if (!e) return { title: "Event" };
  const description = `${e.local.date} · ${e.local.time} · ${e.venue.name}, ${e.city.name}. ${e.caption}`.trim();
  return {
    title: e.title,
    description,
    openGraph: { title: e.title, description, images: e.poster ? [{ url: e.poster, alt: e.poster_alt || e.title }] : [] },
  };
}

export default async function Page({ params }: PageProps<"/events/[slug]">) {
  const { slug } = await params;
  return (
    <>
      <EventsView />
      <AdoptSheet type="event" slug={slug} />
    </>
  );
}
