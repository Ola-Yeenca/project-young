import type { Metadata } from "next";
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

export default async function Page({ params }: PageProps<"/talent/[slug]">) {
  const { slug } = await params;
  return (
    <>
      <TalentView />
      <AdoptSheet type="talent" slug={slug} />
    </>
  );
}
