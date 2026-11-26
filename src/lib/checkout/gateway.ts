import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import Razorpay from "razorpay";
import { z } from "zod";

export function getRazorpayTestConfig() {
  const {
    RAZORPAY_KEY_ID: keyId,
    RAZORPAY_KEY_SECRET: keySecret,
    NEXT_PUBLIC_RAZORPAY_KEY_ID: publicKeyId,
  } = process.env;
  if (
    !keyId ||
    !/^rzp_test_[A-Za-z0-9]+$/.test(keyId) ||
    keyId !== publicKeyId ||
    !keySecret
  ) {
    return null;
  }
  return { keyId, keySecret };
}

export function getTestGateway() {
  const config = getRazorpayTestConfig();
  if (!config) throw new Error("Razorpay Test Mode is unavailable");
  const sdk = new Razorpay({
    key_id: config.keyId,
    key_secret: config.keySecret,
  });
  const local = process.env.RAZORPAY_TEST_LOCAL_ENDPOINT;
  const origin = local ? URL.parse(local) : new URL("https://api.razorpay.com");
  if (
    !origin ||
    (local &&
      (config.keyId !== "rzp_test_Day06Fixture" ||
        origin.hostname !== "127.0.0.1" ||
        origin.protocol !== "http:" ||
        origin.origin !== local))
  )
    throw new Error("Invalid Razorpay Test Mode endpoint");

  const endpoint = origin;
  const authorization = Buffer.from(
    config.keyId + ":" + config.keySecret,
  ).toString("base64");
  async function request(path: string, body?: object): Promise<unknown> {
    const response = await fetch(new URL(path, endpoint), {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: "Basic " + authorization,
        ...(body && { "Content-Type": "application/json" }),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(4500),
    });
    if (!response.ok) {
      void response.body?.cancel().catch(() => undefined);
      throw new Error("Razorpay verification is unavailable");
    }
    return response.json();
  }
  const fixtureOrder = z.object({
    id: z.string(),
    amount: z.number(),
    currency: z.string(),
    receipt: z.string(),
  });
  const orders = local
    ? {
        create: async (body: {
          amount: number;
          currency: string;
          receipt: string;
          partial_payment: boolean;
        }) => fixtureOrder.parse(await request("/v1/orders", body)),
        all: async ({ receipt, count }: { receipt: string; count: number }) =>
          z
            .object({ items: fixtureOrder.array() })
            .parse(
              await request(
                "/v1/orders?" +
                  new URLSearchParams({ receipt, count: String(count) }),
              ),
            ),
      }
    : sdk.orders;
  return {
    orders,
    keySecret: config.keySecret,
    fetchPayment: (id: string) =>
      request("/v1/payments/" + encodeURIComponent(id)),
    fetchOrderPayments: (id: string) =>
      request("/v1/orders/" + encodeURIComponent(id) + "/payments"),
  };
}

export function matchesSignature(
  orderId: string,
  paymentId: string,
  signature: string,
  secret: string,
) {
  return matchesHmac(`${orderId}|${paymentId}`, signature, secret);
}

export function matchesHmac(
  body: string | Uint8Array,
  signature: string,
  secret: string,
) {
  if (signature.length !== 64 || !/^[0-9a-f]{64}$/i.test(signature))
    return false;
  const expected = createHmac("sha256", secret).update(body).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}
