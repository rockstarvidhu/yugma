# Reference-led storefront review

The review starts at PR #23 head `5b49d2d2efa78db868c45b97e436fe878eecb8de`. Its tree matches the main-branch squash `066e269`. The two subsequent Day 06 commits were replayed before the storefront edits, producing the same starting tree as `main` at `2449ecc`. The local review branch is `feat/reference-led-storefront`.

## Local preview

From the review worktree, run these PowerShell commands. The input directory should contain the extracted Batch 04 manifest and assets. The preparation script checks the SHA-256 of each imported file.

```powershell
npm ci
node scripts/prepare-storefront-art.mjs 'D:/Temp/frontend/YUGMA_Batch_04'
npm run build
$env:YUGMA_STOREFRONT_PHOTO_PREVIEW='1'
npm run start -- --hostname 127.0.0.1 --port 3174
```

Open [the review site](http://127.0.0.1:3174). The homepage reads the review switch at request time. With the variable unset, it serves the branded forest treatment, omits the two concepts and returns 404 for candidate artwork. The browser demo works without service credentials. Studio, checkout and publishing require the existing service configuration. The fixture runner exercises all three locally.

## Reference comparison

| Screen          | Implementation and intentional differences                                                                                                                                                                                                                                                                                                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Arrival         | Separate desktop and mobile botanical backgrounds, original emblem and wordmark, live tagline and luminous line. The 1.22-second introduction dismisses immediately on interaction and skips repeat arrivals, direct section links and reduced motion.                                                                                                                                                       |
| Hero            | The hero reference controls the joined-hands crop, upper wordmark, bottom-left copy, controls and downward cue. The portrait uses a separate source. The original logo has angular contours that are more apparent at this scale.                                                                                                                                                                            |
| Purpose         | Architecture fades into the right-hand ivory field on desktop and enters from below the copy on phones.                                                                                                                                                                                                                                                                                                      |
| Collection      | The carousel uses native horizontal scroll and snapping, with previous, next, keyboard and touch controls. Registered listings generate released slides and product sections. Afterglow uses a watermarked capture of the real renderer. Heritage and Serenity are private visual-review concepts. The single-design public catalogue omits carousel controls.                                               |
| Product         | Decorative architecture and the actual cover have separate roles. Demo and personalization are available. The local visual-only configuration shows availability. Where private test checkout is configured, the review reads the eligible active template price from PostgreSQL. Checkout uses the saved order or authoritative eligible draft price. The current order contract supplies no tax breakdown. |
| Demo            | The registered renderer, sample watermark, venue links and exit are live. The storyboard’s video controls would imply a timed film, so the route uses the invitation’s own navigation.                                                                                                                                                                                                                       |
| Personalization | Valid public Afterglow edits update the renderer. Studio supplies its own live cover, Details and Photos links, explicit save, guarded full preview and existing private media flow.                                                                                                                                                                                                                         |
| Checkout        | The summary uses the real template, names and order total. Pending, recovery and verified states use the existing Razorpay Test Mode flow.                                                                                                                                                                                                                                                                   |
| Completion      | Only a server-loaded owner publication displays the forest completion screen. View My Invitation opens its guest URL. Manage Invitation opens Studio. Clipboard and native sharing use the existing share component.                                                                                                                                                                                         |
| Footer          | The final line follows absolute scroll position in both directions and becomes static for reduced motion. A configured `STOREFRONT_SUPPORT_EMAIL` supplies a direct mailbox. The fallback gives draft and guest help.                                                                                                                                                                                        |

## Artwork and brand audit

The source package was already extracted. Every file matched its ZIP entry and every manifest SHA-256 matched the supplied bytes. The 12 review imports, their source names, checksums and approval status are recorded in `src/lib/storefront-art.json`. They remain outside `public/` and outside Git. The collection’s floral edge is a subtle independent layer derived from the supplied composite. The source already contains detail in its foliage and grain.

The desktop hero is 1672 × 941 and the separately composed portrait is 941 × 1672. Both are synthetic candidates. The joined hands are centrally visible at the primary sizes. The overlapping fingers obscure some contours, especially in portrait. Creative and commercial-use approval is pending. The sourcing notes point to genuine photographs but supply no photo files or participant releases. The architectural and botanical imagery and teaser concepts also await approval for public use.

The repository sand wordmark is one plain SVG path with four closed subpaths, 273 line segments and no embedded raster image. Its viewBox is `-14 -14 1832 436`. The drawing spans (0, 0) to (1804, 408), leaving 14 units on all sides. The sand emblem uses a `-24 -24 763 969` viewBox and 224 line segments. Neither uses a clip path. The large wordmark uses intrinsic height and a single proportional width. Browser measurements verified the 1832:436 ratio at all seven widths. The G and other curved outlines show the angular geometry of the supplied reconstruction. A smooth original vector master is needed for a closer match. The repository SVG bytes were preserved.

Afterglow uses `public/images/storefront/afterglow-editorial-portrait.webp` captured from its registered renderer. The source photo credit is recorded on the fictional invitation fixture. The supplied square recording crop, speculative Afterglow cover and flattened storyboard panels are excluded from product UI.

## Verification and evidence

Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run format:check` and `npm run build`. On Windows checkouts with Git CRLF conversion, `npm run format:check -- --end-of-line auto` checks formatting while respecting the checkout convention.

The visual runner accepts an external Playwright package through `PLAYWRIGHT_MODULE` and an optional Chromium executable through `CHROME_PATH`. Set `PREVIEW_URL` to the running server. The publication runner also accepts `PGLITE_MODULE` and starts a separate loopback production server with disposable Auth, PostgreSQL, object storage and signed payment fixtures.

```powershell
node scripts/verify-reference-storefront.mjs
node scripts/verify-reference-storefront.mjs --webkit
$env:PUBLISH_EVIDENCE_DIR='artifacts/storefront-editorial/private/journey'
node scripts/verify-publish-flow.mjs
```

The private evidence directory holds full-resolution screenshots, forward-and-reverse recordings, checks and a local review gallery. The original PR #23 smoke-script name remains usable. Its renderer artwork export is also available through `--capture-afterglow`.

The review passed all 294 unit tests, lint, type checking and the production build. Chromium passed at 320, 390, 430, 768, 1024, 1440 and 1920 CSS pixels. WebKit passed at 390 and 1440. The checks cover page overflow, hero source and proportions, session arrival, reduced motion, 200% reflow, focus restoration, carousel endpoints and reversal, Chromium touch input, marquee stopping and position restoration, real demo edits, deep links, unavailable hero images and script-free access to the main content. Initial Chromium layout-shift scores were below 0.001 at every size.

In the disposable journey a changed database price appeared on the private review, an invalid payment callback kept the draft private, and a signed capture advanced the order through the server verification path. An owner could edit, explicitly publish, share and open the invitation in a fresh browser context. Signed-out, unpaid and cross-account requests were rejected. Revoked and deleted invitations and their covers returned 404.

The CI formatting command passed against an LF export of the staged tree. A disposable PostgreSQL 16.16 instance passed all repository migrations, draft and media authorization, publication checks, schema export and the draft backup/restore fingerprint comparison. Authorization checks passed again on the restored database.

The first browser pass exposed a full-viewport minimum height on the embedded Studio cover. Its scoped styles now size it to the artwork. The final pass also used a shorter checkout heading scale, more room for adjacent collection previews and a capture that waits for the demo image to decode.

## Files and launch gates

- `src/components/storefront/`, the homepage route, and the brand and review artwork helpers implement the homepage, interactions and responsive treatments.
- `src/templates/`, `src/lib/storefront-catalogue.ts`, `src/lib/checkout/catalogue.ts` and `src/app/templates/` connect listings and eligible test prices to the catalogue.
- `src/components/preview/`, `src/components/studio/`, the demo, checkout and publish routes implement the connected customer screens.
- `scripts/prepare-storefront-art.mjs`, both storefront verification entries, `scripts/verify-publish-flow.mjs` and the focused tests reproduce the review.

Public launch awaits photograph and artwork clearance, approval for any teaser exposure, a public support mailbox and commercial pricing, tax, payment and publishing decisions. The payment and publication evidence here uses isolated test services. Real-device assistive-technology testing and creative sign-off remain separate from the recorded automated browser review.
