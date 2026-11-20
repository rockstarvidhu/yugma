# Homepage final visual review

The homepage work began at `06441e05c7e516c1da9addbb09d303cddda3c6df` on `feat/home-collection`, continuing [PR #13](https://github.com/rockstarvidhu/yugma/pull/13).

## Featured invitation

Afterglow uses one portrait capture from the real invitation and one Preview Experience link to `/demo/afterglow`. The template registry gates the catalogue. The gallery shows carousel controls only when it receives multiple distinct templates. The local two-template test fixture covers arrows, keyboard, mobile swipe, desktop drag, and the neighbouring artwork. Unpublished entries have an In development label and no live preview action.

The portrait takes most of the available width on phones. At desktop widths the portrait and description sit side by side. The bottom of the photo blends into the sand canvas before the photo recedes. The original scroll controller remains reversible and keeps the joined hands in view through the handoff. Skip intro disappears after the scene. Reduced motion and JavaScript-disabled browsers retain static copy and normal scrolling.

## Hero art and publication

The six original WebP variants are byte-identical and live under `assets/home-hero/`. Local `next dev` serves an allowlisted image from `/dev/home-hero/[file]`. Production renders the existing YUGMA brand SVG with visible heading and collection link. Production returns HTTP 404 for the six development asset routes and their previous public paths. The art remains in the repository and its history. Its AI image usage terms still need confirmation before the photographic hero can go live.

## Integration

Merge `5872402` brought `origin/main` at `1d6758e` into the feature branch. The main squash tree exactly matched the earlier Day 1 feature tree at `23bef9c`. Reapplying the reviewed homepage changes to that common content resolved these conflicts without changing the pre-merge feature tree:

- `artifacts/home-collection/day-1/README.md`
- `src/app/page.tsx` and `src/app/page.test.tsx`
- `src/components/storefront/Storefront.tsx`, `Storefront.test.tsx`, `StorefrontHeader.tsx` and `storefront.css`
- `src/lib/storefront-catalogue.ts`

The merge was also checked for automatically reintroduced files. The obsolete temporary photograph and its three old screenshots remain absent from the feature tree. The recovery reference is `refs/backup/home-collection-before-final-polish-06441e0`.

## Verification

`npm ci`, ESLint, Prettier, TypeScript, timeline test discovery, all 163 Vitest tests, and the Turbopack build passed locally. The build passed on retry after an existing Next.js advisory. No dependency changes were made.

The Chrome smoke runner is `scripts/verify-home-scroll-collection.mjs`. Run it against `npm run dev` for the photographic sequence and against `npm run start` with `--production` for the brand fallback and demos. Pass the server origin using `PREVIEW_URL` and, when Playwright is installed separately, set `PLAYWRIGHT_MODULE`. Screenshots, recordings and JSON results are saved locally under `artifacts/home-collection/final-review/`. Full-page screenshots show the static reduced-motion layout. The videos show the live scroll handoff.

Review the [GitHub Actions checks](https://github.com/rockstarvidhu/yugma/pull/13/checks) on the exact PR head and confirm the peer review there before merging.
