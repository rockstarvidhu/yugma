# Razorpay checkout in Test Mode

Afterglow costs ₹899. The server sends `89900` paise, `INR` and a unique receipt to Razorpay's Orders API. The order endpoint accepts only a signed-in owner's Afterglow draft ID and reuses its stored test order on retry.

| Endpoint                   | JSON request                                                     | Success                          |
| -------------------------- | ---------------------------------------------------------------- | -------------------------------- |
| `POST /api/create-order`   | `{ draftId }`                                                    | `{ order_id, amount, currency }` |
| `POST /api/verify-payment` | `{ razorpay_payment_id, razorpay_order_id, razorpay_signature }` | `{ success: true }`              |

Verification calculates HMAC-SHA256 using the server-stored order ID and checks the gateway's captured payment, amount and currency. Test results are recorded in the existing orders table as `test_verified`. Paid and published invitations require a separate captured order.

## Run a test payment

1. Use a Supabase test project with all migrations applied. An existing project running private drafts needs `20261120235900_razorpay_test_checkout.sql`. Set its three `SUPABASE_*` variables in an ignored `.env.local` and create or reuse a confirmed test user.
2. In `.env`, set the Razorpay Test Mode secret and put the same Test Mode key ID in both `RAZORPAY_KEY_ID` and `NEXT_PUBLIC_RAZORPAY_KEY_ID`. Restart the dev server after changing the environment. Production builds inline public variables and need a rebuild when the public key changes.
3. Run `npm run dev`, open `/studio` and sign in. Open an existing Afterglow draft or select **Start an Afterglow draft**. Select **Pay ₹899 (test)**, then choose Razorpay's test success or failure option. If capture is pending, use **Retry verification**.

Keep the Razorpay secret and the Supabase secret in server-only configuration. Manage payment capture settings in Razorpay Test Mode. This integration verifies the browser's checkout callback. Webhook recovery is still needed to reconcile payments when the browser never returns a callback.
