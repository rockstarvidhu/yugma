import type { Metadata } from "next";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { requireStudioUser } from "@/lib/auth/server";
import { signOut } from "./actions";

export const metadata: Metadata = {
  title: "Your studio",
  robots: { index: false, follow: false },
};

export default async function StudioPage({
  searchParams,
}: PageProps<"/studio">) {
  await requireStudioUser("/studio");
  const signOutFailed = (await searchParams).error === "sign-out";

  return (
    <main className="yugma-brand min-h-screen py-12">
      <Container className="grid max-w-lg gap-6">
        <BrandLogo href="/" label="YUGMA home" className="w-32" />
        <h1 className="font-editorial text-4xl">Your studio</h1>
        <p>You’re signed in.</p>
        {signOutFailed && <p role="alert">Couldn’t sign out. Try again.</p>}
        <form action={signOut}>
          <Button type="submit" variant="secondary">
            Sign out
          </Button>
        </form>
      </Container>
    </main>
  );
}
