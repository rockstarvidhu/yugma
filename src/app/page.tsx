import type { Metadata } from "next";
import { Instrument_Serif, Manrope } from "next/font/google";
import { Storefront } from "@/components/storefront/Storefront";
import { getLocalHero } from "@/lib/storefront-hero";

const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-home-manrope",
});
const accent = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: "italic",
  display: "swap",
  variable: "--font-home-accent",
});

export const metadata: Metadata = {
  title: { absolute: "YUGMA — Digital wedding invitations" },
  description:
    "Beautifully crafted digital invitations, made to tell your story.",
  openGraph: {
    title: "YUGMA",
    description:
      "Beautifully crafted digital invitations, made to tell your story.",
    type: "website",
    images: [
      {
        url: "/brand/yugma-og-brand.png",
        width: 1200,
        height: 630,
        alt: "YUGMA — thoughtfully crafted digital invitations",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "YUGMA",
    images: ["/brand/yugma-og-brand.png"],
  },
};

export default function Home() {
  return (
    <div className={`${manrope.variable} ${accent.variable}`}>
      <Storefront photo={getLocalHero()} />
    </div>
  );
}
