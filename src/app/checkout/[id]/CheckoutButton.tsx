"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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

async function post<T>(url: string, body: object) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as T & { error?: string };
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
  keyId,
}: {
  draftId: string;
  amount: number;
  currency: string;
  initialState: CheckoutState;
  keyId?: string;
}) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<CheckoutState>(initialState);
  const [message, setMessage] = useState("");
  const [signIn, setSignIn] = useState(false);
  const [confirmation, setConfirmation] = useState<CheckoutConfirmation>();
  const launching = useRef(false);
  const signInUrl = `/sign-in?next=${encodeURIComponent(`/checkout/${draftId}`)}`;
  const storageKey = `yugma:checkout:${draftId}`;

  const remember = useCallback(
    (payment?: CheckoutConfirmation) => {
      try {
        if (payment)
          sessionStorage.setItem(storageKey, JSON.stringify(payment));
        else sessionStorage.removeItem(storageKey);
      } catch {
        // The current page can verify even when browser storage is unavailable.
      }
    },
    [storageKey],
  );

  const finishVerification = useCallback(
    (result: "failed" | "verified") => {
      setState((current) => (current === "verified" ? current : result));
      setConfirmation(undefined);
      setMessage("");
      remember();
    },
    [remember],
  );

  const refreshStatus = useCallback(
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
        const { state: savedState } = (await response.json()) as {
          state: CheckoutState;
        };
        if (signal?.aborted) return;
        if (savedState === "verified" || savedState === "failed")
          finishVerification(savedState);
        else if (savedState === "processing") {
          setState((current) =>
            current === "verified" ? current : "processing",
          );
          setMessage("");
        }
      } catch {
        if (!signal) setMessage("Couldn’t check payment status. Try again.");
      }
    },
    [draftId, finishVerification],
  );

  useEffect(() => {
    if ((state !== "processing" && state !== "pending") || busy || signIn)
      return;
    const controller = new AbortController();
    let attempts = 0;
    let timer = setTimeout(poll, 2500);
    async function poll() {
      await refreshStatus(controller.signal);
      if (!controller.signal.aborted && ++attempts < 12)
        timer = setTimeout(poll, 5000);
    }
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [busy, refreshStatus, signIn, state]);

  function checkStatus() {
    let saved: CheckoutConfirmation | undefined;
    try {
      const value = sessionStorage.getItem(storageKey);
      if (value) {
        const data = JSON.parse(value) as Partial<CheckoutConfirmation> | null;
        if (
          typeof data?.razorpay_payment_id === "string" &&
          typeof data.razorpay_order_id === "string" &&
          typeof data.razorpay_signature === "string"
        )
          saved = data as CheckoutConfirmation;
      }
    } catch {
      // The server can still show the state of the saved order.
    }
    if (saved) void verify(saved);
    else void refreshStatus();
  }

  async function verify(payment: CheckoutConfirmation) {
    setBusy(true);
    setState("processing");
    setConfirmation(payment);
    setMessage("");
    remember(payment);
    try {
      const { status, ok, data } = await post<{
        success?: boolean;
        state?: CheckoutState;
      }>("/api/verify-payment", payment);
      if (status === 401) setSignIn(true);
      else if (ok && data.success) finishVerification("verified");
      else if (ok && data.state === "failed") finishVerification("failed");
      else if (status === 400 || status === 404) {
        remember();
        setConfirmation(undefined);
        setState("pending");
        setMessage(
          "We couldn’t verify the checkout response. Check your payment status.",
        );
      } else if (status !== 409) {
        setMessage("Verification is temporarily unavailable. Try again.");
      }
    } catch {
      setMessage("Verification is temporarily unavailable. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function openCheckout() {
    const Razorpay = checkoutConstructor();
    if (!Razorpay || !keyId || launching.current) return;
    launching.current = true;
    setBusy(true);
    setMessage("");
    function release() {
      launching.current = false;
      setBusy(false);
    }

    try {
      const { ok, status, data } = await post<
        CheckoutOrder & { state?: CheckoutState }
      >("/api/create-order", { draftId });
      if (!ok) {
        if (status === 401) setSignIn(true);
        else if (status === 409) {
          if (data.state === "verified") finishVerification("verified");
          else if (data.state === "processing") setState("processing");
          else router.refresh();
        } else setMessage(data.error ?? "Couldn’t start checkout. Try again.");
        release();
        return;
      }
      if (
        data.amount !== amount ||
        data.currency !== currency ||
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
        key: keyId,
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
    keyId && state !== "verified" && state !== "processing" && !signIn;
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
          {!confirmation &&
            (state === "pending" ||
              state === "failed" ||
              state === "processing") && (
              <Button variant="secondary" disabled={busy} onClick={checkStatus}>
                Check payment status
              </Button>
            )}
        </>
      )}
    </div>
  );
}
