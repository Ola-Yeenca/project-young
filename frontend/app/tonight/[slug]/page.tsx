import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getEvent } from "@/lib/server";
import { Tonight } from "@/components/taste/Tonight";

export async function generateMetadata({ params }: PageProps<"/tonight/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const e = await getEvent(slug);
  return { title: e ? `Tonight · ${e.title}` : "Tonight", robots: { index: false } };
}

export default function Page({ params }: PageProps<"/tonight/[slug]">) {
  return (
    <Suspense fallback={<section className="view active"><div className="wrap tn"><span className="sk taste-line"></span></div></section>}>
      <Load params={params} />
    </Suspense>
  );
}

async function Load({ params }: { params: PageProps<"/tonight/[slug]">["params"] }) {
  const { slug } = await params;
  const e = await getEvent(slug);
  if (!e) notFound();
  return <Tonight e={e} />;
}
