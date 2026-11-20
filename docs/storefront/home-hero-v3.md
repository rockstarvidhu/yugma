# Responsive homepage hero

[Draft PR #13](https://github.com/rockstarvidhu/yugma/pull/13) continues on `feat/home-collection` from `33c5c4d207fb7ba1c605eefa872165fca9d4ea36`. The change is limited to the hero, its handoff and the carousel’s product labeling.

## Photography and branding

The six exact WebP exports are committed under `public/images/home/hero/`. The original JPGs and delivery kit stay outside the application. Both independent compositions are AI-generated and text-free. The desktop exports are resampled from 1123 × 632. The mobile 810px and 1080px exports are resampled from 788 × 1402. The 540px portrait is downsampled.

| Composition | File                          | Encoded bytes |
| ----------- | ----------------------------- | ------------: |
| Desktop     | `hero-desktop-1280x720.webp`  |       166,390 |
| Desktop     | `hero-desktop-1600x900.webp`  |       209,692 |
| Desktop     | `hero-desktop-1920x1080.webp` |       251,872 |
| Mobile      | `hero-mobile-540x960.webp`    |        61,692 |
| Mobile      | `hero-mobile-810x1440.webp`   |       118,542 |
| Mobile      | `hero-mobile-1080x1920.webp`  |       159,666 |

Chrome requests one hero image on initial load. At 320 × 568 and DPR 1, the 540px portrait transferred 61,992 bytes. At 390 × 844 and DPR 2, the 1080px portrait transferred 159,966 bytes. At 1440 × 900 and DPR 1, the 1920px landscape transferred 252,172 bytes. These transfer measurements include Chrome’s reported response overhead.

The picture switches at 900px. The portrait is positioned at 52% 64% and the landscape at 55% 60%. The white and forest wordmarks and the other supplied brand SVGs match the repository files byte for byte. The previously restricted photograph and its loopback preview are outside this implementation. Confirm the AI image provider’s applicable usage terms before public launch.

## Motion and controls

The 176svh sticky sequence scales the photograph to at most 1.08 on phones and 1.09 on desktop. A localized scrim appears with the headline. The sand collection overlaps the photograph during the handoff. The hero remains static with visible copy and a collection link with reduced motion or JavaScript disabled.

The collection identifies one registered design, **Afterglow**, with two gallery views. Heirloom cover links to `/demo/heirloom`, and celebration details links to `/demo/afterglow#celebration`. The existing touch, drag, arrow and keyboard controls are retained. The artwork is lazy-loaded.

## Browser evidence

Run the existing script against a local production server with Chrome and Playwright available.

```sh
npm run build
npm run start -- --hostname 127.0.0.1 --port 3180
# In a second terminal, from the same checkout:
PREVIEW_URL=http://127.0.0.1:3180 node scripts/verify-home-scroll-collection.mjs --production
```

The script accepts `PLAYWRIGHT_MODULE` for a separately installed Playwright package and `CHROME_PATH` for an alternate Chrome executable. It writes the mobile and desktop screenshots, two WebM recordings and `production-results.json` to the ignored `artifacts/home-collection/hero-v3/` directory. The viewport set is 320 × 568, 375 × 667, 390 × 844, 430 × 932, 768 × 1024, 1024 × 768, 1440 × 900 and 1920 × 1080.

The production Chrome run passed at all eight viewport sizes. It covers image selection, crop, forward and reverse scroll, resize, touch emulation, mouse drag, keyboard, focus and skip navigation, reduced motion, and JavaScript disabled. Both demo routes passed at 320 and 1440 with the watermark, invalid and valid personalization, reset and reload. The Chrome recordings capture forward scroll, carousel interaction and reverse scroll.

`npm ci`, ESLint, Prettier, TypeScript, timeline test discovery, and all 161 Vitest tests passed. The Turbopack production build passed on retry after Next.js displayed an advisory. No packages were added or updated.

## GitHub status

The fetched base was `1d6758e85d5b264d8f7d1554cde6a4d9dc7d9a2e`. Its tree matches the earlier feature commit `23bef9c` exactly, but PR #12's squash merge gave it a different commit identity. PR #13 subsequently edits files added by both histories. An isolated three-way merge preview found conflicts in:

- `artifacts/home-collection/day-1/README.md`
- `src/app/page.tsx` and `src/app/page.test.tsx`
- `src/components/storefront/Storefront.tsx`, `Storefront.test.tsx`, `StorefrontHeader.tsx` and `storefront.css`
- `src/lib/storefront-catalogue.ts`

The repository workflow uses `pull_request` against `main`. [GitHub skips that event while a PR has merge conflicts](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request). See [PR #13 checks](https://github.com/rockstarvidhu/yugma/pull/13/checks) for the remote status. No history rewrite or merge was performed.
