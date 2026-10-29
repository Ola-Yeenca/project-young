import type { Metadata } from "next";
import { Suspense } from "react";
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

// The list renders straight away; only the sheet depends on the URL (kept inside Suspense).
export default function Page({ params }: PageProps<"/events/[slug]">) {
  return (
    <>
      <EventsView />
      <Suspense fallback={null}>
        <Adopt params={params} />
      </Suspense>
    </>
  );
}

async function Adopt({ params }: { params: PageProps<"/events/[slug]">["params"] }) {
  const { slug } = await params;
  return <AdoptSheet type="event" slug={slug} />;
}
