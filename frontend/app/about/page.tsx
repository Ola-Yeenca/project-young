import type { Metadata } from "next";
import { AboutView } from "@/components/home/Story";

export const metadata: Metadata = {
  title: "About",
  description: "House of Young has run events and backed artists in Valencia and Lagos since 2022. The Vision Is Ours.",
};

export default function Page() {
  return <AboutView />;
}
