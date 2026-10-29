import type { Metadata } from "next";
import { Suspense } from "react";
import { GalleryView } from "@/components/pages/Views";

export const metadata: Metadata = { title: "Gallery" };

/** /gallery/:slug is the gallery with that album's chip selected. */
export default function Page({ params }: PageProps<"/gallery/[slug]">) {
  return (
    <Suspense fallback={<GalleryView />}>
      <Album params={params} />
    </Suspense>
  );
}

async function Album({ params }: { params: PageProps<"/gallery/[slug]">["params"] }) {
  const { slug } = await params;
  return <GalleryView album={slug} />;
}
