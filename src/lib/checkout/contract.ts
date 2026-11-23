export const AFTERGLOW_PRICE_PAISE = 89_900;
export const CHECKOUT_CURRENCY = "INR";

export type CheckoutOrder = {
  order_id: string;
  amount: number;
  currency: typeof CHECKOUT_CURRENCY;
  key_id: string;
};

export type CheckoutState =
  "ready" | "pending" | "failed" | "processing" | "verified";

export type CheckoutConfirmation = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};
