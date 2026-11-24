# Day 6 verified payment evidence

The screenshots show the loopback production app with fictional invitation data. PostgreSQL ran through PGlite. Authentication, object storage and the authoritative Razorpay HTTP responses used local fixtures.

- [Verified checkout, still private](verified-private.png)
- [Anonymous guest view after owner publication](anonymous-published.png)
- [Sanitized Playwright results](playwright-results.json)

The fixture created a server-priced INR 899 order, held publication while authorization was pending, recovered capture from a fresh owner browser context and exercised a transient provider outage. Three concurrent webhook requests yielded one stored event outcome. The paid owner edited the draft before publishing, copied the same link on desktop and mobile, then opened it anonymously with working directions and a published cover. The disposable route was revoked and deleted at the end of the run.

Independent native PostgreSQL sessions also verified twelve simultaneous callback/webhook transactions and eight simultaneous publication transactions. One order retained verified entitlement, one webhook event was recorded, and one slug was published.

[Earlier Test Mode capture under PR #25](../day-6/README.md) and [this PR's hosted acceptance procedure](../../../docs/platform/day-06-verified-fulfilment.md).
