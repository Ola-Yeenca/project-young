import type { Metadata } from "next";
import { GalleryView } from "@/components/pages/Views";

export const metadata: Metadata = { title: "Gallery" };

/** /gallery/:slug is the gallery with that album's chip selected. */
export default async function Page({ params }: PageProps<"/gallery/[slug]">) {
  const { slug } = await params;
  return <GalleryView album={slug} />;
}
