import type { Metadata } from "next";
import { GalleryView } from "@/components/pages/Views";

export const metadata: Metadata = { title: "Gallery" };

export default function Page() {
  return <GalleryView />;
}
