import type { Metadata } from "next";
import { ShopView } from "@/components/pages/Views";

export const metadata: Metadata = { title: "Shop" };

export default function Page() {
  return <ShopView />;
}
