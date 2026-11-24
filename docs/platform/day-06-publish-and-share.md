# Day 06 payment to invitation

## Staging configuration

Apply the repository migrations in order and configure the staging app with the Supabase, Razorpay Test Mode and private R2 settings in `.env.example`. Set `STAGING_INVITATION_PUBLISHING=true` and set `SITE_URL` to the public staging origin. Add `<staging origin>/auth/confirm` to the Supabase Auth redirect allowlist if email confirmations are enabled. Add the staging origin to the private R2 bucket CORS policy and configure the Razorpay Test Mode webhook.

The existing staging project already has the early auth, draft and checkout schema. Check its migration history against the schema before any bulk migration push.

| Route            | Verification                                                                                                                                                                                                           |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/checkout/[id]` | The owner sees verification and the publish link after the draft-scoped status API reports a verified receipt. Polling and manual verification recover delayed capture.                                                |
| `/publish/[id]`  | The owner reviews the current saved invitation, chooses a title and slug, and confirms that the link and cover become public. The server checks the owner, verified order, and version in the publication transaction. |
| `/i/[slug]`      | Anonymous guests see the published invitation and metadata. Cover photos go through a slug-scoped route that checks publication on each request.                                                                       |
| `/studio`        | Published invitations have a share link. Reopening the old editor or checkout URL returns the owner to sharing.                                                                                                        |

Test receipts stay in the Razorpay Test Mode order lifecycle. Staging publication uses a service-only RPC and a separate read projection. The existing captured-payment projection serves legacy publications.

## Negative cases

- A signed-out request returns 401 and a request for someone else’s draft returns 404.
- A missing, pending or merely authorized receipt cannot publish. A rejected callback and an invalid webhook cannot mark checkout verified.
- A verified receipt leaves the draft private. An edit after verification invalidates a previously loaded publish form.
- A duplicate request returns the original link. A slug owned by a different publication cannot be overwritten.
- Unknown, unpublished, revoked and deleted slugs return 404 for both the page and cover. Guest responses contain no private storage key or draft media URL.
- The sharing screen confirms a successful clipboard write. WhatsApp and the native share sheet handle sending.

## Playwright evidence

Build with `npm run build` and run `node scripts/verify-publish-flow.mjs` with Playwright, Chromium and PGlite installed. When packages are installed outside the repo, set `PLAYWRIGHT_MODULE` and `PGLITE_MODULE` to their package directories. The runner starts and stops a loopback production server and writes screenshots plus `playwright-results.json` to `artifacts/day-06/`. The test uses a disposable database with the repository migrations, fixture Auth and object storage, and signed webhook fixtures.

The hosted release check uses the exact same four routes with separate browser contexts for the owner and guest. Complete a Razorpay Test Mode payment, publish, copy the link on desktop and mobile, and open it in a fresh browser context. Use a fictional invitation and cover.
