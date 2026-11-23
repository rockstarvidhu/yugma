"use client";

import Link from "next/link";
import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import type {
  CheckoutConfirmation,
  CheckoutOrder,
  CheckoutState,
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

type CheckoutResponse = Partial<CheckoutOrder> & {
  error?: string;
  state?: CheckoutState;
  success?: boolean;
};

async function post(url: string, body: object) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as CheckoutResponse;
  return { status: response.status, ok: response.ok, data };
}

const statusCopy: Record<CheckoutState, string> = {
  ready: "",
  pending: "Checkout started. You can resume with your saved draft.",
  failed: "Test payment failed. You can try again.",
  processing: "Processing payment. Your draft is saved.",
  verified:
    "Test payment verified. No money was charged. Your invitation is still private.",
};

export function CheckoutButton({
  draftId,
  amount,
  currency,
  initialState,
  canPay,
}: {
  draftId: string;
  amount: number;
  currency: string;
  initialState: CheckoutState;
  canPay: boolean;
}) {
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState(initialState);
  const [message, setMessage] = useState("");
  const [signIn, setSignIn] = useState(false);
  const [confirmation, setConfirmation] = useState<CheckoutConfirmation>();
  const launching = useRef(false);
  const signInUrl = `/sign-in?next=${encodeURIComponent(`/checkout/${draftId}`)}`;

  const checkStatus = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const response = await fetch(`/api/checkout/${draftId}`, {
          cache: "no-store",
          signal,
        });
        if (signal?.aborted) return;
        if (response.status === 401) {
          setSignIn(true);
          return;
        }
        if (!response.ok) throw new Error("Checkout status unavailable");
        const data = (await response.json()) as CheckoutResponse;
        if (signal?.aborted) return;
        if (data.state && data.state !== "ready" && data.state !== "pending") {
          const nextState = data.state;
          setState((previous) =>
            previous === "verified" ? previous : nextState,
          );
          if (nextState !== "processing") {
            setMessage("");
            setConfirmation(undefined);
          }
        }
      } catch {
        if (!signal) setMessage("Couldn’t check payment status. Try again.");
      }
    },
    [draftId],
  );

  useEffect(() => {
    if (state !== "processing" || signIn || busy) return;
    const controller = new AbortController();
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      await checkStatus(controller.signal);
      if (!controller.signal.aborted && ++attempts < 12)
        timer = setTimeout(poll, 5000);
    }
    timer = setTimeout(poll, 2500);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [busy, checkStatus, signIn, state]);

  async function verify(payment: CheckoutConfirmation) {
    setBusy(true);
    setState("processing");
    setConfirmation(payment);
    setMessage("");
    try {
      const { status, ok, data } = await post("/api/verify-payment", payment);
      if (status === 401) setSignIn(true);
      else if (ok && data.success) {
        setState("verified");
        setConfirmation(undefined);
      } else if (ok && data.state === "failed") {
        setState("failed");
        setConfirmation(undefined);
      } else if (!ok) {
        if (status === 400 || status === 404) {
          setConfirmation(undefined);
          setMessage(
            "We couldn’t verify the checkout response. Check your payment status.",
          );
        } else {
          setMessage("Verification is temporarily unavailable. Try again.");
        }
      }
    } catch {
      setMessage("Verification is temporarily unavailable. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function openCheckout() {
    const Razorpay = checkoutConstructor();
    if (!Razorpay || launching.current) return;
    launching.current = true;
    setBusy(true);
    setMessage("");
    function release() {
      launching.current = false;
      setBusy(false);
    }

    try {
      const { ok, status, data } = await post("/api/create-order", { draftId });
      if (!ok) {
        if (status === 401) setSignIn(true);
        else if (
          status === 409 &&
          (data.state === "verified" || data.state === "processing")
        )
          setState(data.state);
        else setMessage(data.error ?? "Couldn’t start checkout. Try again.");
        release();
        return;
      }
      if (
        data.amount !== amount ||
        data.currency !== currency ||
        !data.key_id ||
        !data.order_id
      ) {
        setMessage(
          "The order details changed. Reload checkout to review the latest total.",
        );
        release();
        return;
      }
      setState("pending");
      let submitted = false;
      let failed = false;
      const checkout = new Razorpay({
        key: data.key_id,
        order_id: data.order_id,
        amount: data.amount,
        currency: data.currency,
        name: "YUGMA",
        description: "Afterglow invitation (test)",
        handler: (payment) => {
          if (submitted) return;
          submitted = true;
          launching.current = false;
          void verify(payment);
        },
        modal: {
          ondismiss: () => {
            if (submitted) return;
            release();
            if (failed) setState("failed");
            setMessage(
              failed ? "" : "Checkout cancelled. Your draft is saved.",
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
      release();
      setMessage("Couldn’t start checkout. Try again.");
    }
  }

  const canOpen =
    canPay && state !== "verified" && state !== "processing" && !signIn;
  return (
    <div className="grid gap-2">
      {canOpen && (
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
      )}
      {canOpen && (
        <Button disabled={!ready || busy} onClick={() => void openCheckout()}>
          {busy
            ? "Opening checkout…"
            : state === "failed"
              ? "Retry test payment"
              : "Open Razorpay Test Mode"}
        </Button>
      )}
      <p role="status">
        {state === "processing" || state === "verified"
          ? statusCopy[state]
          : message || statusCopy[state]}
      </p>
      {state === "processing" && message && <p role="status">{message}</p>}
      {signIn ? (
        <Link className="studio-link justify-self-start" href={signInUrl}>
          Sign in to resume checkout
        </Link>
      ) : (
        <>
          {confirmation && (
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => void verify(confirmation)}
            >
              Retry verification
            </Button>
          )}
          {(state === "processing" ||
            state === "pending" ||
            state === "failed") && (
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => void checkStatus()}
            >
              Check payment status
            </Button>
          )}
        </>
      )}
    </div>
  );
}
