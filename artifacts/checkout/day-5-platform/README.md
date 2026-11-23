# Day 05 Developer B payment verification

The smoke test ran the production Next.js build with fictional draft data, disposable PostgreSQL, and a local Supabase-compatible Auth and REST transport. The Orders API and Standard Checkout modal used the configured Razorpay Test Mode account. Webhook deliveries used locally signed fixtures with synthetic payment IDs.

- Concurrent checkout requests produced one genuine Razorpay order at the fixture catalogue amount of ₹987.65. The app rejected client-supplied amount and currency fields.
- Changing the catalogue amount preserved the existing order snapshot. The genuine modal displayed ₹987.65 after the change. Cancellation kept the draft private. A locally signed failure event made the same order retryable.
- The route rejected a tampered webhook signature before parsing. A signed event with a mismatched amount left the payment processing. Duplicate captures committed one audit event and kept the initial verification timestamp. A later failure preserved the verified state.
- The browser picked up the signed capture fixture through status polling. The order stayed verified after reload, and the invitation stayed a draft with no share slug.
- The genuine Razorpay order remained in the created state. The webhook fixture changed the disposable application's payment record.

[Browser assertions and order details](verification.json) · [Razorpay order modal](razorpay-server-price.png) · [Processing state](processing-payment.png) · [Webhook-recovered state](webhook-verified-payment.png)

Local checks passed for 293 tests, lint, type checking, formatting, production build, and the PostgreSQL migration and authorization suites.
