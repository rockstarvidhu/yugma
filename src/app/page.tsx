import type { Metadata } from "next";
import { Storefront } from "@/components/storefront/Storefront";

// Corporate sharing metadata stays on the corporate route, not invitation routes.
export const metadata: Metadata = {
  title: { absolute: "YUGMA — Digital wedding invitations" },
  description:
    "Beautifully crafted digital invitations that bring your wedding story to life. Explore a YUGMA sample and try your details.",
  openGraph: {
    title: "YUGMA",
    description:
      "Beautifully crafted digital invitations that bring your wedding story to life.",
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
  return <Storefront />;
}
