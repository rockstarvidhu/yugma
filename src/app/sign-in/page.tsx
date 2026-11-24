import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Container } from "@/components/ui/Container";
import { getSupabaseConfig } from "@/lib/auth/client";
import { getStudioUser } from "@/lib/auth/server";
import { studioReturnPath } from "@/lib/auth/studio-path";
import { stagingPublishingEnabled } from "@/lib/publish/store";
import { SignInForm } from "./SignInForm";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function SignInPage({
  searchParams,
}: PageProps<"/sign-in">) {
  const query = await searchParams;
  const returnTo = studioReturnPath(query.next);
  const registration = stagingPublishingEnabled();
  const creating = registration && query.mode === "signup";
  const configured = Boolean(getSupabaseConfig());
  if (configured && (await getStudioUser())) redirect(returnTo);

  return (
    <main className="yugma-brand min-h-screen py-12">
      <Container className="grid max-w-lg gap-6">
        <BrandLogo href="/" label="YUGMA home" className="w-32" />
        <h1 className="font-editorial text-4xl">
          {creating ? "Create your YUGMA account" : "Sign in to YUGMA"}
        </h1>
        {configured ? (
          <>
            <SignInForm
              key={String(creating)}
              returnTo={returnTo}
              creating={creating}
            />
            {registration && (
              <Link
                className="underline justify-self-start"
                href={`/sign-in?next=${encodeURIComponent(returnTo)}${creating ? "" : "&mode=signup"}`}
              >
                {creating
                  ? "Already have an account? Sign in"
                  : "Create an account"}
              </Link>
            )}
            {query.confirmation === "failed" && (
              <p role="alert">
                This confirmation link couldn’t be used. Try signing in or
                creating an account again.
              </p>
            )}
          </>
        ) : (
          <p>Sign-in is currently unavailable.</p>
        )}
      </Container>
    </main>
  );
}
