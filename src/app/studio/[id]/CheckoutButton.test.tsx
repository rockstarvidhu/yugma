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
const order = { order_id: "order_Fixture123", amount: 89900, currency: "INR" };
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
  render(<CheckoutButton draftId={draftId} keyId={keyId} />);
  const pay = screen.getByRole("button", { name: "Pay ₹899 (test)" });
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
    expect(options).toMatchObject({ key: keyId, ...order });
    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      "/api/create-order",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ draftId }),
      }),
    );
    act(() => options.handler(confirmation));
    expect(
      await screen.findByText("Test payment verified. No money was charged."),
    ).toBeVisible();
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
    expect(pay).toBeEnabled();
    expect(fetcher).toHaveBeenCalledTimes(2);
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
    fireEvent.click(
      await screen.findByRole("button", { name: "Retry verification" }),
    );
    expect(
      await screen.findByText("Test payment verified. No money was charged."),
    ).toBeVisible();
    expect(open).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls.map(([path]) => path)).toEqual([
      "/api/create-order",
      "/api/verify-payment",
      "/api/verify-payment",
    ]);
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
