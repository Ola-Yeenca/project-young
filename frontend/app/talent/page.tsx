import type { Metadata } from "next";
import { TalentView } from "@/components/pages/Views";

export const metadata: Metadata = { title: "Talent" };

export default function Page() {
  return <TalentView />;
}
