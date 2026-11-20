import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { getServerAuth, requireStudioUser } from "@/lib/auth/server";
import { createServiceClient } from "@/lib/auth/service";
import { getRazorpayTestConfig } from "@/lib/checkout/gateway";
import {
  findTestOrder,
  loadAfterglowCheckoutDraft,
} from "@/lib/checkout/store";
import { draftIdSchema } from "@/lib/drafts/contract";
import { CheckoutButton } from "./CheckoutButton";

export const metadata: Metadata = {
  title: "Afterglow checkout",
  robots: { index: false, follow: false },
};

export default async function DraftStudioPage({
  params,
}: PageProps<"/studio/[id]">) {
  const { id } = await params;
  const user = await requireStudioUser(`/studio/${id}`);
  if (!draftIdSchema.safeParse(id).success) notFound();
  const client = await getServerAuth();
  if (
    !client ||
    !(await loadAfterglowCheckoutDraft({ client, ownerId: user.id }, id))
  )
    notFound();

  const config = getRazorpayTestConfig();
  let checkout: React.ReactNode = <p>Razorpay Test Mode is unavailable.</p>;
  if (config && process.env.SUPABASE_SECRET_KEY?.startsWith("sb_secret_")) {
    const order = await findTestOrder(createServiceClient(), user.id, {
      draftId: id,
    });
    checkout =
      order?.status === "test_verified" ? (
        <p role="status">Test payment verified. No money was charged.</p>
      ) : (
        <CheckoutButton draftId={id} keyId={config.keyId} />
      );
  }

  return (
    <main className="yugma-brand min-h-screen py-12">
      <Container className="grid max-w-lg gap-6">
        <Link href="/studio" className="underline">
          Back to Studio
        </Link>
        <h1 className="font-editorial text-4xl">Afterglow checkout</h1>
        <p>Razorpay Test Mode</p>
        {checkout}
      </Container>
    </main>
  );
}
