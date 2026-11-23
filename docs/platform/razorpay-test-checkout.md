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
3. Run `npm run dev`, open `/studio` and sign in. Open or create an Afterglow draft, save any changes, then select **Continue to checkout**. The summary at `/checkout/[id]` shows the catalogue price or the stored order amount for a resumed order. Enable `CHECKOUT_STAGING_POLICIES=true` in staging to show test checkout information and provide the staging support contact with `CHECKOUT_SUPPORT_EMAIL`.
4. Select **Open Razorpay Test Mode** and exercise cancellation, failure, retry, and test success. A callback displays **Processing payment** until the server verifies capture. Use **Retry verification** while capture is pending, or **Check payment status** after a reload in the same browser tab. After reopening checkout, the page reloads the draft and any stored order from the server.

Keep the Razorpay secret and the Supabase secret in server-only configuration. Manage payment capture settings in Razorpay Test Mode. This integration verifies the browser's checkout callback. Webhook recovery is still needed to reconcile payments when the browser never returns a callback.
