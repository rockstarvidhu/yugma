# Razorpay checkout in Test Mode

In Private Studio, save an Afterglow draft and select **Continue to checkout**. The purchase summary at `/checkout/[id]` shows the active catalogue price, or the saved order amount when a checkout already exists. The migration initializes the existing Afterglow test price of ₹899 (89,900 INR paise). Test captures leave the invitation private.

| Endpoint                      | Request                                                          | Success                                                                                                                                          |
| ----------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST /api/create-order`      | `{ draftId }`                                                    | `{ order_id, amount, currency }`                                                                                                                 |
| `POST /api/verify-payment`    | `{ razorpay_payment_id, razorpay_order_id, razorpay_signature }` | `{ success: true }` on capture, `409` with `{ state: "processing" }` while authorized, or `{ state: "failed" }` for a provider-confirmed failure |
| `GET /api/checkout/[id]`      | Saved draft ID in the path                                       | `{ state }`                                                                                                                                      |
| `POST /api/webhooks/razorpay` | Signed Razorpay event and event ID headers                       | `204` after durable processing or deduplication                                                                                                  |

The customer endpoints authenticate the owner. PostgreSQL reserves one order per invitation with an immutable catalogue price, currency, and template binding. The reservation holder creates the Razorpay order outside the database transaction. A retry after the 45-second reservation expires first looks up the saved receipt at Razorpay and reuses a matching order. The app presents the provider order after the database associates it with the reservation.

Callback verification computes the HMAC using the stored order ID and checks the provider payment ID, order ID, amount, currency and capture status. The webhook checks the HMAC on raw bytes before reading JSON. PostgreSQL commits the event ID and any order transition together, including when callback verification and the webhook arrive concurrently. Test outcomes use `test_reserving`, `test_created`, `test_failed`, `test_processing`, and `test_verified`. Publishing requires a separate captured order.

## Run a sandbox checkout

1. Apply the repository migrations to your Supabase staging database. Set the Supabase variables from `.env.example` in ignored local configuration or the staging secret store. Sign in with a confirmed staging user.
2. Use the Razorpay dashboard in **Test Mode**. Configure `RAZORPAY_KEY_SECRET` on the server and set the same Test Mode ID in `RAZORPAY_KEY_ID` and `NEXT_PUBLIC_RAZORPAY_KEY_ID`. Rebuild after changing the public key ID. Turn on automatic capture in Test Mode.
3. Configure a dedicated `RAZORPAY_WEBHOOK_SECRET` on the server and use the same secret in the Test Mode dashboard. Subscribe the staging HTTPS endpoint `/api/webhooks/razorpay` to `payment.captured`, `payment.failed`, and optionally `order.paid`. Enable `CHECKOUT_STAGING_POLICIES=true` and set `CHECKOUT_SUPPORT_EMAIL` to the approved staging contact if available.
4. Open a saved Afterglow draft. Check the draft details and INR total, start the Razorpay modal, then exercise cancel, test failure, retry and test success. Close or reload while a payment is processing and return to the same checkout. The order stays private after the server records the test capture.
5. Check the Razorpay test order in the dashboard. Its ID, amount and currency should match the launch response. Confirm webhook delivery and verify that a repeated event leaves the order and verified timestamp intact.

Test Mode and live activation have separate dashboard settings. Use the merchant dashboard to check KYC and account activation, and verify the intended website or app and approved customer policies before enabling a live integration. [Razorpay Test and Live Modes](https://razorpay.com/docs/payments/dashboard/test-live-modes/) · [Razorpay API keys](https://razorpay.com/docs/payments/dashboard/account-settings/api-keys/) · [Razorpay webhook validation](https://razorpay.com/docs/webhooks/validate-test/)
