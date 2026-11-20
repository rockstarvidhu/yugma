"use client";

import Script from "next/script";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  AFTERGLOW_PRICE_PAISE,
  type CheckoutConfirmation,
  type CheckoutOrder,
} from "@/lib/checkout/contract";

type RazorpayCheckout = new (options: {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  handler: (payment: CheckoutConfirmation) => void;
  modal: { ondismiss: () => void };
}) => {
  on: (event: "payment.failed", handler: () => void) => void;
  open: () => void;
};

function checkoutConstructor() {
  return (window as Window & { Razorpay?: RazorpayCheckout }).Razorpay;
}

async function post<T>(url: string, body: object) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as T & { error?: string };
  return { status: response.status, ok: response.ok, data };
}

const price = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
}).format(AFTERGLOW_PRICE_PAISE / 100);

export function CheckoutButton({
  draftId,
  keyId,
}: {
  draftId: string;
  keyId: string;
}) {
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmation, setConfirmation] = useState<CheckoutConfirmation>();

  async function verify(payment: CheckoutConfirmation) {
    setBusy(true);
    setConfirmation(payment);
    setMessage("Verifying test payment…");
    try {
      const { ok, status, data } = await post<{ success: boolean }>(
        "/api/verify-payment",
        payment,
      );
      if (ok && data.success) {
        setVerified(true);
        setConfirmation(undefined);
        setMessage("Test payment verified. No money was charged.");
      } else {
        if (status === 400 || status === 404 || status === 401)
          setConfirmation(undefined);
        setMessage(data.error ?? "Verification failed. Try again.");
      }
    } catch {
      setMessage("Verification failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function openCheckout() {
    const Razorpay = checkoutConstructor();
    if (!Razorpay) return;
    setBusy(true);
    setMessage("");
    try {
      const { ok, data } = await post<CheckoutOrder>("/api/create-order", {
        draftId,
      });
      if (!ok) {
        setMessage(data.error ?? "Couldn’t start checkout. Try again.");
        setBusy(false);
        return;
      }
      let submitted = false;
      let failed = false;
      const checkout = new Razorpay({
        key: keyId,
        order_id: data.order_id,
        amount: data.amount,
        currency: data.currency,
        name: "YUGMA",
        description: "Afterglow invitation (test)",
        handler: (payment) => {
          submitted = true;
          void verify(payment);
        },
        modal: {
          ondismiss: () => {
            if (submitted) return;
            setBusy(false);
            setMessage(
              failed
                ? "Test payment failed. You can try again."
                : "Checkout cancelled.",
            );
          },
        },
      });
      checkout.on("payment.failed", () => {
        if (submitted) return;
        failed = true;
        setMessage("Test payment failed. Retry in Razorpay or close checkout.");
      });
      checkout.open();
    } catch {
      setBusy(false);
      setMessage("Couldn’t start checkout. Try again.");
    }
  }

  return (
    <div className="grid gap-3">
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="afterInteractive"
        onReady={() => {
          const loaded = Boolean(checkoutConstructor());
          setReady(loaded);
          if (!loaded)
            setMessage("Checkout could not load. Reload to try again.");
        }}
        onError={() =>
          setMessage("Checkout could not load. Reload to try again.")
        }
      />
      {!verified &&
        (confirmation ? (
          <Button disabled={busy} onClick={() => void verify(confirmation)}>
            {busy ? "Verifying…" : "Retry verification"}
          </Button>
        ) : (
          <Button disabled={!ready || busy} onClick={() => void openCheckout()}>
            Pay {price} (test)
          </Button>
        ))}
      <p role="status" aria-live="polite">
        {message}
      </p>
    </div>
  );
}
