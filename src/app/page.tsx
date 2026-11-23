import type { Metadata } from "next";
import { Inter_Tight } from "next/font/google";
import { Storefront } from "@/components/storefront/Storefront";
import { canCreatePrivateDraft } from "@/lib/auth/service";

const interTight = Inter_Tight({
  subsets: ["latin"],
  weight: ["500", "600"],
  display: "swap",
  variable: "--font-home-inter-tight",
});

export const metadata: Metadata = {
  title: { absolute: "YUGMA — Digital wedding invitations" },
  description: "Digital wedding invitations for the story only you can tell.",
  openGraph: {
    title: "YUGMA",
    description: "Digital wedding invitations for the story only you can tell.",
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
  const studioAvailable = canCreatePrivateDraft();
  return (
    <Storefront
      fontClass={interTight.variable}
      studioAvailable={studioAvailable}
    />
  );
}
