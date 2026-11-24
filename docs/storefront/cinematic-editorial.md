# Cinematic editorial storefront

This document records PR #23. For the current review build, asset setup and browser checks, see [Reference-led storefront review](reference-led-review.md).

The storefront starts from `ca99092eaefc547df6aba6ef726c0fbf038512b0`, which includes the historical homepage PR #13, Studio PR #18, media PR #19 and the Day 5 checkout work. `feat/storefront-cinematic-editorial` is isolated from the previous homepage, Studio, media and cinematic prototype worktrees.

## Visual review

The GitHub repository is public. The six clean WebPs from the approved kit and any captures showing them stay in ignored local directories while rights and source quality are unresolved. The default build shows the branded hero and returns 404 for the candidate photographs. No reference composites or large source-review files are published.

For a local review, extract the supplied ZIP outside the repository. From the storefront worktree, copy only the six `assets/hero/` WebPs into `assets/storefront-hero-review/`. These files keep their kit filenames and byte content. Then run:

```sh
npm ci
YUGMA_STOREFRONT_PHOTO_PREVIEW=1 npm run build
YUGMA_STOREFRONT_PHOTO_PREVIEW=1 npm run start -- --hostname 127.0.0.1 --port 3167
```

Use `http://127.0.0.1:3167`. Set the flag at both build and start because the homepage is pre-rendered and the image route evaluates it on each request. Leave the flag unset on public deployments. The asset route requires an allowed filename and gives private, non-cacheable responses. A supported reduced-data media query selects the smallest crop for that viewport. Without support, the browser uses the normal responsive source set.

The photo kit documents an underlying source of roughly 1123 × 632 pixels. The larger WebPs are resampled exports. Review the handhold anatomy, final crop and native sharpness at intended display sizes and document rights for commercial use before publishing the candidate.

## Product and routes

- The white hero wordmark and both emblem variants reuse the repository originals. Their SHA-256 hashes match the approved kit.
- Inter Tight loads through `next/font/google` for the homepage. Invitation and Studio typography stay on their existing fonts.
- `/demo/afterglow` is the live registered sample. The homepage features two responsive crops from a production Chrome capture of that route, with the actual demo mark preserved. `--capture-afterglow` in the browser script regenerates these stills from the renderer.
- `/demo/afterglow?personalize=1#preview-editor` opens the existing browser preview editor. `/demo/heirloom` remains a sample alias for the same design.
- `/#templates` opens the featured design, `/templates` is the closing CTA, and `/studio` is linked when private draft configuration is present. The footer links to the existing GitHub issues contact.
- Afterglow is the only registered design. The homepage offers demo and personalization links. Private checkout uses the active Supabase catalogue price for new orders and the saved order price for resumed checkouts.

## Browser verification

Use Playwright installed outside the repository and point `PLAYWRIGHT_MODULE` at its package directory if needed. `CHROME_PATH` can select a system Chrome binary. `PREVIEW_URL` defaults to the loopback server above. The script writes into the ignored `artifacts/storefront-editorial/private/` directory unless `STOREFRONT_EVIDENCE_DIR` specifies another destination.

```sh
node scripts/verify-storefront-editorial.mjs --photo --record
node scripts/verify-storefront-editorial.mjs --photo --webkit
```

Omit `--photo` for the default build. The script exercises desktop and mobile layouts, forward and reverse opacity, stable text geometry, launch actions, direct anchors and reload, keyboard focus, browser fallbacks and sample routes. Measurements come from local production builds and browser emulation.

Hosted Supabase, Cloudflare R2 and Razorpay are separate launch checks. Verify authorized staging sign-in, private draft and media behavior, the hosted checkout, and the approved publishing flow before enabling live sales.
