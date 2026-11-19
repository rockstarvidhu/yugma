# Homepage scroll and collection redesign

## Scope and branch

Continued `feat/home-collection` in the existing Day 1 worktree. It started clean at `23bef9c2f638a46563f5a694c7cde1f7e88b7d1e`. The fetched `origin/main` was the Day 1 squash commit `1d6758e85d5b264d8f7d1554cde6a4d9dc7d9a2e`, with an identical starting file tree. Day 1 PR #12 is merged. The redesign stays on the existing branch. The cinematic and backend worktrees are outside its scope.

## Hero and rights gate

The internal kit provided `assets/hero/yugma-hands-INTERNAL-ONLY.webp` (706 × 447, **66,010 bytes**). Keep it in the extracted kit outside the repository. It has **unverified storefront rights and insufficient resolution for a large production hero**. The production homepage uses the supplied brand-only SVG (**837 bytes**), with its headline and action visible immediately. The configured photo source is centralized in `src/lib/storefront-hero.ts`. A rights-cleared high-resolution successor can replace that source and use Next Image optimization and preload for a launch hero.

The internal photograph is served only by a separate loopback HTTP process. The page includes its loopback URL only in the Next.js development runtime with the explicit flag set. The browser loads it directly. Production compiles out that URL even if the opt-in is set. It is absent from the tracked public tree, Open Graph and preload hints. The former temporary public crop is removed from this revision. Day 1 captures showing that crop are kept as ignored local evidence. Older Git history still contains the prior asset and captures.

Use these commands in two terminals at the repository root for internal review:

```sh
node scripts/serve-home-hero-local.mjs "/path/to/kit/assets/hero/yugma-hands-INTERNAL-ONLY.webp"
```

```sh
YUGMA_LOCAL_HERO=1 npm run dev -- --hostname 127.0.0.1 --port 3160
```

Open <http://127.0.0.1:3160>. Keep both services on loopback and treat the local evidence as internal. Regular development and all production builds use the brand fallback. The production verification intentionally passes the opt-in flag at build and launch and checks that the image is still absent.

## Design and catalogue

The native scroll stage runs for 196svh. One passive scroll controller, coalesced with requestAnimationFrame, drives the photo crop, push-in, Manrope headline, and actual collection panel. The sand panel rises over the visible photo with artwork already in frame. The header changes its surface, foreground and official wordmark together. At the end, the hero yields to the collection's natural document flow. Reduced motion and failed photo loading use the static layout. On keyboard skip, focus moves to the collection.

The existing registry exposes one design, `afterglow`. Both real sample routes use that renderer and the same fictional sample. The carousel presents two distinct views inside that design:

| View                | Source captured in Chrome             | Link                          | Status                     |
| ------------------- | ------------------------------------- | ----------------------------- | -------------------------- |
| Heirloom cover      | `.heirloom-cover` on `/demo/heirloom` | `/demo/heirloom`              | Watermarked demo available |
| Celebration details | `#celebration` on `/demo/afterglow`   | `/demo/afterglow#celebration` | Watermarked demo available |

The 592 × 833 cover and 592 × 438 celebration WebPs are browser crops of the actual demo markup. Their combined source weight is **46,356 bytes**. The fixed page badge was hidden only during the cropped artwork capture. The running demo routes still display their watermark. No extra design, price, purchase status, creation route, catalogue route, or contact channel was invented. Existing route and registry contracts still govern live destinations.

The carousel shows a neighboring view on phones, approximately two panels on desktop, and advances through native touch scroll, pointer dragging, buttons and keyboard commands. Direct view links remain normal anchors and native scroll snapping still works without JavaScript.

## Visual and automated evidence

The internal evidence directory is `artifacts/home-collection/visual-v2/`. It is intentionally ignored because it includes views of the supplied internal photograph. It contains the requested 11 PNGs, both real Chrome WebM recordings, internal browser measurements and the separate production rights-gate result. Use the handoff frames in the PNGs and video to evaluate the cut from photo to art. The full-page desktop PNG is a static overview of the document since one full-page image cannot represent pinned motion.

The production smoke test also exercises both invitation demos and their personalization and watermark. Use external Playwright without adding a repository package:

```sh
PLAYWRIGHT_MODULE=/path/to/playwright node scripts/verify-home-scroll-collection.mjs
PLAYWRIGHT_MODULE=/path/to/playwright PREVIEW_URL=http://127.0.0.1:3162 node scripts/verify-home-scroll-collection.mjs --production
```

Chrome QA covers 320 × 568, 375 × 667, 390 × 844, 430 × 932, 768 × 1024, 1024 × 768, and 1440 × 900. Physical phones and Safari were not tested. The photographic route is suitable for internal visual review. Public photography still needs usage approval and a higher-resolution original. The full product catalogue and checkout/creation routes remain future work.

## Validation results

- Clean npm install, ESLint, TypeScript, Prettier and 161 Vitest tests across nine files passed. The production build passed on retry after the existing Next.js security-advisory interruption.
- The first artwork had entered at 0.65 on 320px and at 0.60 on 390px and 1440px, with the photographic layer still at full opacity. Inspected screenshots and recordings confirmed the headline stayed clear of the joined hands and the sand panel carried visible artwork through the handoff.
- The production homepage and both existing demos returned 200. The local-only asset URL was absent from production markup and requests, and all three tested photo paths returned 404. The demo watermark, validation, personalization, reset and reload worked at 320px and 1440px.
