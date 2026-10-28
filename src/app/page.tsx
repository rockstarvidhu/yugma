import type { Metadata } from "next";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Container } from "@/components/ui/Container";

// Corporate sharing metadata stays on the corporate route, not invitation routes.
export const metadata: Metadata = {
  openGraph: {
    title: "YUGMA",
    description: "Thoughtfully crafted digital invitations.",
    type: "website",
    images: [{ url: "/brand/yugma-og-brand.png", width: 1200, height: 630, alt: "YUGMA — thoughtfully crafted digital invitations" }],
  },
  twitter: { card: "summary_large_image", title: "YUGMA", images: ["/brand/yugma-og-brand.png"] },
};

export default function Home() {
  return (
    <main className="yugma-brand flex min-h-svh items-center">
      <Container className="py-24 text-center">
        <h1><BrandLogo priority /></h1>
        <p className="mt-8 text-sm leading-7 text-muted">Thoughtfully crafted digital invitations.</p>
      </Container>
    </main>
  );
}
