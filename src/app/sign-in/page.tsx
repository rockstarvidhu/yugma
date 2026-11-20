import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Container } from "@/components/ui/Container";
import { getSupabaseConfig } from "@/lib/auth/client";
import { getStudioUser } from "@/lib/auth/server";
import { studioReturnPath } from "@/lib/auth/studio-path";
import { SignInForm } from "./SignInForm";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function SignInPage({
  searchParams,
}: PageProps<"/sign-in">) {
  const returnTo = studioReturnPath((await searchParams).next);
  const configured = Boolean(getSupabaseConfig());
  if (configured && (await getStudioUser())) redirect(returnTo);

  return (
    <main className="yugma-brand min-h-screen py-12">
      <Container className="grid max-w-lg gap-6">
        <BrandLogo href="/" label="YUGMA home" className="w-32" />
        <h1 className="font-editorial text-4xl">Sign in to YUGMA</h1>
        {configured ? (
          <SignInForm returnTo={returnTo} />
        ) : (
          <p>Sign-in is currently unavailable.</p>
        )}
      </Container>
    </main>
  );
}
