import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ComponentProps } from "react";
import type Script from "next/script";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CheckoutConfirmation } from "@/lib/checkout/contract";
import { CheckoutButton } from "./CheckoutButton";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("next/script", () => ({
  default: ({ onReady, onError }: ComponentProps<typeof Script>) => (
    <>
      <button onClick={onReady}>Load checkout script</button>
      <button onClick={onError}>Fail checkout script</button>
    </>
  ),
}));

const draftId = "e1000000-0000-4000-8000-000000000001";
const keyId = "rzp_test_Fixture";
const order = {
  order_id: "order_Fixture123",
  amount: 98525,
  currency: "INR",
};
const verifiedCopy =
  "Test payment verified. No money was charged. Your invitation is still private.";
const confirmation = {
  razorpay_order_id: order.order_id,
  razorpay_payment_id: "pay_CapturedFixture",
  razorpay_signature: "f".repeat(64),
};
let options: {
  handler: (payment: CheckoutConfirmation) => void;
  modal: { ondismiss: () => void };
};
let paymentFailed: () => void;
const fetcher = vi.fn();
const open = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.clear();
  vi.stubGlobal("fetch", fetcher);
  vi.stubGlobal(
    "Razorpay",
    class {
      constructor(input: typeof options) {
        options = input;
      }
      open = open;
      on(_event: string, callback: () => void) {
        paymentFailed = callback;
      }
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderCheckout() {
  render(
    <CheckoutButton
      draftId={draftId}
      amount={order.amount}
      currency={order.currency}
      initialState="ready"
      keyId={keyId}
    />,
  );
  const pay = screen.getByRole("button", { name: "Open Razorpay Test Mode" });
  expect(pay).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Load checkout script" }));
  expect(pay).toBeEnabled();
  return pay;
}

describe("Studio Test Mode checkout", () => {
  it("opens the Razorpay modal with the server order and verifies the callback", async () => {
    fetcher
      .mockResolvedValueOnce(Response.json(order))
      .mockResolvedValueOnce(Response.json({ success: true }));
    fireEvent.click(renderCheckout());
    await waitFor(() => expect(open).toHaveBeenCalledOnce());
    expect(options).toMatchObject({
      key: keyId,
      order_id: order.order_id,
      amount: order.amount,
      currency: order.currency,
    });
    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      "/api/create-order",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ draftId }),
      }),
    );
    act(() => options.handler(confirmation));
    expect(await screen.findByText(verifiedCopy)).toBeVisible();
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      "/api/verify-payment",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(confirmation),
      }),
    );
  });

  it("handles dismiss and a failed payment without submitting verification", async () => {
    fetcher.mockImplementation(() => Promise.resolve(Response.json(order)));
    const pay = renderCheckout();
    fireEvent.click(pay);
    await waitFor(() => expect(open).toHaveBeenCalledTimes(1));
    act(() => options.modal.ondismiss());
    expect(screen.getByRole("status")).toHaveTextContent("Checkout cancelled.");
    expect(pay).toBeEnabled();

    fireEvent.click(pay);
    await waitFor(() => expect(open).toHaveBeenCalledTimes(2));
    act(() => paymentFailed());
    expect(screen.getByRole("status")).toHaveTextContent(
      "Test payment failed.",
    );
    act(() => options.modal.ondismiss());
    fireEvent.click(screen.getByRole("button", { name: "Retry test payment" }));
    await waitFor(() => expect(open).toHaveBeenCalledTimes(3));
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("allows retrying a pending verification without opening a new order", async () => {
    fetcher
      .mockResolvedValueOnce(Response.json(order))
      .mockResolvedValueOnce(
        Response.json({ error: "Awaiting capture." }, { status: 409 }),
      )
      .mockResolvedValueOnce(Response.json({ success: true }));
    fireEvent.click(renderCheckout());
    await waitFor(() => expect(open).toHaveBeenCalledOnce());
    act(() => options.handler(confirmation));
    expect(screen.getByRole("status")).toHaveTextContent("Processing payment.");
    expect(screen.queryByText(verifiedCopy)).not.toBeInTheDocument();
    fireEvent.click(
      await screen.findByRole("button", { name: "Retry verification" }),
    );
    expect(await screen.findByText(verifiedCopy)).toBeVisible();
    expect(open).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls.map(([path]) => path)).toEqual([
      "/api/create-order",
      "/api/verify-payment",
      "/api/verify-payment",
    ]);
  });

  it("retries a pending confirmation from the same browser tab after reload", async () => {
    sessionStorage.setItem(
      `yugma:checkout:${draftId}`,
      JSON.stringify(confirmation),
    );
    fetcher.mockResolvedValueOnce(Response.json({ success: true }));
    render(
      <CheckoutButton
        draftId={draftId}
        amount={order.amount}
        currency={order.currency}
        initialState="pending"
        keyId={keyId}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Checkout started.");
    fireEvent.click(
      screen.getByRole("button", { name: "Check payment status" }),
    );
    expect(await screen.findByText(verifiedCopy)).toBeVisible();
    expect(fetcher).toHaveBeenCalledWith(
      "/api/verify-payment",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(confirmation),
      }),
    );
    expect(sessionStorage.getItem(`yugma:checkout:${draftId}`)).toBeNull();
  });

  it("offers sign-in with a return to the same checkout when the session expires", async () => {
    fetcher.mockResolvedValueOnce(Response.json({}, { status: 401 }));
    fireEvent.click(renderCheckout());
    const link = await screen.findByRole("link", {
      name: "Sign in to resume checkout",
    });
    expect(link).toHaveAttribute(
      "href",
      `/sign-in?next=%2Fcheckout%2F${draftId}`,
    );
    expect(open).not.toHaveBeenCalled();
  });

  it("clears a rejected callback without showing a verified payment", async () => {
    fetcher
      .mockResolvedValueOnce(Response.json(order))
      .mockResolvedValueOnce(
        Response.json({ error: "Invalid signature." }, { status: 400 }),
      );
    fireEvent.click(renderCheckout());
    await waitFor(() => expect(open).toHaveBeenCalledOnce());
    act(() => options.handler(confirmation));
    expect(
      await screen.findByText(/couldn’t verify the checkout response/i),
    ).toBeVisible();
    expect(screen.queryByText(verifiedCopy)).not.toBeInTheDocument();
    expect(sessionStorage.getItem(`yugma:checkout:${draftId}`)).toBeNull();
  });

  it("asks for a refreshed summary if the order quote changed", async () => {
    fetcher.mockResolvedValueOnce(Response.json({ ...order, amount: 100 }));
    fireEvent.click(renderCheckout());
    expect(await screen.findByText(/order details changed/i)).toBeVisible();
    expect(open).not.toHaveBeenCalled();
  });

  it("shows gateway setup and script errors", async () => {
    fetcher.mockResolvedValueOnce(
      Response.json(
        { error: "Checkout is temporarily unavailable." },
        { status: 500 },
      ),
    );
    const pay = renderCheckout();
    fireEvent.click(pay);
    expect(
      await screen.findByText("Checkout is temporarily unavailable."),
    ).toBeVisible();
    expect(pay).toBeEnabled();
    fireEvent.click(
      screen.getByRole("button", { name: "Fail checkout script" }),
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Checkout could not load.",
    );
  });
});
