# Day 06 browser evidence

The browser run used a loopback production build, disposable PostgreSQL, fixture Supabase Auth and object storage, and a signed Razorpay capture fixture. The sample names, ceremony and upload are fictional. The server was torn down after the run.

| Route                 | Screenshot                                                                                                                    |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `/demo/afterglow`     | [Afterglow sample](01-sample.png)                                                                                             |
| `/studio/[id]`        | [Saved Studio draft and cover](02-studio-saved-photo.png)                                                                     |
| `/checkout/[id]`      | [Payment processing](03-payment-processing.png), [payment verified](04-payment-verified.png)                                  |
| `/publish/[id]`       | [Publish review](05-publish-review.png), [desktop copy](06-desktop-share.png), [mobile copy and sharing](07-mobile-share.png) |
| `/i/tara-neel-day-06` | [Anonymous guest view](08-incognito-public.png)                                                                               |

[Three-minute walkthrough](walkthrough.webm) · [Playwright results and exact routes](playwright-results.json) · [Release notes and negative cases](../../../docs/platform/day-06-publish-and-share.md)
