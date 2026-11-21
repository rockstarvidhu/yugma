import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import Razorpay from "razorpay";

export function getRazorpayTestConfig() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (
    !keyId ||
    !/^rzp_test_[A-Za-z0-9]+$/.test(keyId) ||
    keyId !== process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ||
    !keySecret
  ) {
    return null;
  }
  return { keyId, keySecret };
}

export function getTestGateway() {
  const config = getRazorpayTestConfig();
  if (!config) throw new Error("Razorpay Test Mode is unavailable");
  return {
    sdk: new Razorpay({ key_id: config.keyId, key_secret: config.keySecret }),
    keySecret: config.keySecret,
  };
}

export function matchesSignature(
  orderId: string,
  paymentId: string,
  signature: string,
  secret: string,
) {
  if (signature.length !== 64 || !/^[0-9a-f]{64}$/i.test(signature))
    return false;
  const expected = createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}
