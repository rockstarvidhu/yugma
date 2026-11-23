# Day 05 Developer A checkout evidence

## Razorpay Test Mode

On November 23, the production Next.js build opened genuine Razorpay Standard Checkout using the configured Test Mode credentials. The app created a ₹899 INR order and verified its ID, amount and currency against Razorpay's Orders API. Closing the modal and reloading preserved the draft. Retrying reopened the modal with the same order ID. The invitation stayed private and no payment was submitted during this run.

- [Razorpay Test Mode modal](razorpay-test-modal-1440.png)
- [Cancelled checkout with a saved draft](razorpay-test-cancelled-1440.png)
- [Reopened Razorpay Test Mode modal](razorpay-test-retry-1440.png)
- [Test Mode assertions and order details](razorpay-test-results.json)

## Local callback and recovery smoke

The local smoke used a production Next.js build, disposable PostgreSQL, a local Supabase-compatible Auth and REST fixture, and a simulated Razorpay API and checkout modal. Both runs used fictional invitation details and disposable local draft data.

The fixture opened `/checkout/e5100000-0000-4000-8000-000000000001`. The summary and the modal both displayed ₹899 INR for the same saved order.

- [Desktop purchase summary](checkout-summary-1440.png)
- [Simulated Razorpay modal](checkout-modal-fixture-1440.png)
- [Cancellation with a saved draft](checkout-cancelled-1440.png)
- [Processing on desktop](checkout-processing-1440.png)
- [Processing after a reload on mobile](checkout-processing-390.png)
- [Server-verified test payment on mobile](checkout-verified-390.png)
- [Three-minute walkthrough](checkout-walkthrough.webm)
- [Browser assertions](browser-results.json) and [local test output](verification.txt)

The checkout survived sign-in, cancellation, failure, reload, and browser-tab closure. A callback showed processing while the payment was authorized. Retrying after provider capture showed verification. PostgreSQL reported a private draft with no share slug after the test capture.
