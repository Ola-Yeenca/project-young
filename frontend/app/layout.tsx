import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { getCity, getGlobal } from "@/lib/server";
import { SiteProvider } from "@/components/site";
import { Dock, Footer, Header } from "@/components/shell";
import { Effects } from "@/components/effects";
import { SheetHost } from "@/components/sheets/SheetHost";
import { ShellSkeleton } from "@/components/skeleton";
import "./globals.css";

// Self-hosted faces keep the prototype's family names ("Geist", "Geist Mono", "Instrument Serif"),
// so globals.css names them directly, exactly as the prototype does. The generated variables are
// deliberately not used: they carry a size-adjusted Arial "Fallback" face (Turbopack ignores
// adjustFontFallback: false) that would draw glyphs these fonts lack (← → ↗ ✦ ■) instead of the
// prototype's system-ui fallback.
const geist = Geist({ variable: "--font-geist", subsets: ["latin"], weight: ["300", "400", "500", "600", "800", "900"], adjustFontFallback: false });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], weight: ["400", "500"], adjustFontFallback: false });
const serif = Instrument_Serif({ variable: "--font-instrument-serif", subsets: ["latin"], weight: "400", style: "italic", adjustFontFallback: false });

export const metadata: Metadata = {
  title: { default: "House of Young", template: "%s · House of Young" },
  description:
    "House of Young (HOY) is a creative and entertainment-driven platform: events, talent, merchandise and collaborations, in Valencia and Lagos. The Vision Is Ours.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

async function Site({ children }: { children: React.ReactNode }) {
  const [jar, global] = await Promise.all([cookies(), getGlobal()]);
  const want = jar.get("hoy_city")?.value;
  const slug = global.cities.find((c) => c.slug === want)?.slug ?? global.cities[0]?.slug;
  const initial = slug ? await getCity(slug) : null;
  return (
    <SiteProvider global={global} initial={initial}>
      <Header />
      <main>{children}</main>
      <Footer />
      <Dock />
      <SheetHost />
      <Effects />
    </SiteProvider>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} ${serif.variable}`}>
      <body>
        <div className="app">
          <Suspense fallback={<ShellSkeleton />}>
            <Site>{children}</Site>
          </Suspense>
        </div>
      </body>
    </html>
  );
}
