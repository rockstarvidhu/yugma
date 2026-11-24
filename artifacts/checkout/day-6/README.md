# Day 06 browser evidence

## Razorpay Test Mode capture

The local production build completed a ₹899 netbanking payment through Razorpay's Test Mode bank. Razorpay reported a captured payment and the app independently verified it before showing the publish action. The same run edited the paid draft, published it, copied the link and opened the guest page in a fresh browser session. Auth, storage and PostgreSQL used disposable local fixtures.

[Test bank](razorpay-test/mock-bank.png) · [Verified checkout](razorpay-test/verified-checkout.png) · [Share screen](razorpay-test/share.png) · [Anonymous invitation](razorpay-test/guest.png) · [Test results and exact routes](razorpay-test/playwright-results.json)

## Signed webhook fixture

The browser run used a loopback production build, disposable PostgreSQL, fixture Supabase Auth and object storage, and a signed Razorpay capture fixture. The sample names, ceremony and upload are fictional. The server was torn down after the run.

| Route                 | Screenshot                                                                                                                    |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `/demo/afterglow`     | [Afterglow sample](01-sample.png)                                                                                             |
| `/studio/[id]`        | [Saved Studio draft and cover](02-studio-saved-photo.png)                                                                     |
| `/checkout/[id]`      | [Payment processing](03-payment-processing.png), [payment verified](04-payment-verified.png)                                  |
| `/publish/[id]`       | [Publish review](05-publish-review.png), [desktop copy](06-desktop-share.png), [mobile copy and sharing](07-mobile-share.png) |
| `/i/tara-neel-day-06` | [Anonymous guest view](08-incognito-public.png)                                                                               |

[Three-minute walkthrough](walkthrough.webm) · [Playwright results and exact routes](playwright-results.json) · [Release notes and negative cases](../../../docs/platform/day-06-publish-and-share.md)
