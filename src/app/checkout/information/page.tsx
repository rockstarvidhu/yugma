import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { StudioShell } from "@/components/studio/StudioShell";

export const metadata: Metadata = {
  title: "Test checkout information",
  robots: { index: false, follow: false },
};

export default async function CheckoutInformationPage() {
  // Read this setting at request time, so staging and production can share a build.
  await connection();
  if (process.env.CHECKOUT_STAGING_POLICIES !== "true") notFound();
  const support = process.env.CHECKOUT_SUPPORT_EMAIL;
  return (
    <StudioShell title="Test checkout information">
      <section id="terms" className="studio-panel">
        <h2 className="font-semibold">Terms</h2>
        <p>
          Use this checkout to test your invitation draft with Razorpay Test
          Mode. Use fictional invitation details and Razorpay test payment
          details.
        </p>
      </section>
      <section id="refunds-delivery" className="studio-panel">
        <h2 className="font-semibold">Refunds and delivery</h2>
        <p>
          Test checkout moves no money, so there’s nothing to refund. Your
          invitation stays in Private Studio during the test.
        </p>
      </section>
      <section id="privacy" className="studio-panel">
        <h2 className="font-semibold">Privacy</h2>
        <p>
          YUGMA sends the order amount, currency and receipt reference to
          Razorpay. Enter any test payment details in the Razorpay window.
        </p>
      </section>
      <section id="support" className="studio-panel">
        <h2 className="font-semibold">Support</h2>
        {support && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(support) ? (
          <a
            className="studio-link justify-self-start"
            href={`mailto:${support}`}
          >
            {support}
          </a>
        ) : (
          <p>
            Contact the YUGMA teammate who gave you staging access. Include the
            draft ID and the status you saw.
          </p>
        )}
      </section>
    </StudioShell>
  );
}
