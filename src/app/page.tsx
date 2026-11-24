import { readTestPrices } from "@/lib/checkout/catalogue";
import { storefrontPhotoReviewEnabled } from "@/lib/home-hero-assets";
import type { Metadata } from "next";
import { Storefront } from "@/components/storefront/Storefront";
import { canCreatePrivateDraft } from "@/lib/auth/service";

export const dynamic = "force-dynamic";

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

export default async function Home() {
  const studioAvailable = canCreatePrivateDraft();
  const reviewPrices = storefrontPhotoReviewEnabled()
    ? await readTestPrices().catch(() => ({}))
    : {};
  return (
    <Storefront
      reviewPrices={reviewPrices}
      supportEmail={process.env.STOREFRONT_SUPPORT_EMAIL}
      studioAvailable={studioAvailable}
    />
  );
}
