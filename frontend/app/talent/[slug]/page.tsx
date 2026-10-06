import type { Metadata } from "next";
import { Suspense } from "react";
import { getTalent } from "@/lib/server";
import { TalentView } from "@/components/pages/Views";
import { AdoptSheet } from "@/components/sheets/Adopt";

export async function generateMetadata({ params }: PageProps<"/talent/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const t = await getTalent(slug);
  if (!t) return { title: "Talent" };
  const description = [t.genre, t.city.name].filter(Boolean).join(" · ");
  return { title: t.name, description, openGraph: { title: t.name, description, images: t.photo ? [{ url: t.photo, alt: t.name }] : [] } };
}

// The list renders straight away; only the sheet depends on the URL (kept inside Suspense).
export default function Page({ params }: PageProps<"/talent/[slug]">) {
  return (
    <>
      <TalentView />
      <Suspense fallback={null}>
        <Adopt params={params} />
      </Suspense>
    </>
  );
}

async function Adopt({ params }: { params: PageProps<"/talent/[slug]">["params"] }) {
  const { slug } = await params;
  return <AdoptSheet type="talent" slug={slug} />;
}
