## Summary

Replace YUGMA's identity-only homepage with a responsive storefront foundation: official brand shell, golden-hour hands hero, honest sample collection, How It Works, final CTA and footer. The collection exposes the existing `afterglow` registry entry; no additional product, price, purchasing or publishing capability is implied.

## Branch and baseline

- Head branch: `feat/home-collection`; base: `main`.
- Starting main commit: `1ca685f5adb28ac5a1badccd813043788db75e78` (merged PR #11).
- Separate `day1-home-collection` worktree; no cinematic history or dependencies included.
- Baseline: Next.js App Router, npm lockfile, strict TypeScript, Tailwind v4/Turbopack, shared brand/UI components, canonical Invitation schema, renderer/registry, shared demo watermark and ephemeral customization.
- Root layout, global tokens, shared schema/registry, existing demos, package manifests, lockfile and backend/auth code are unchanged.

## Files changed

- `src/app/page.tsx`, `src/app/page.test.tsx`: homepage and focused brand assertion update.
- `src/components/storefront/`: server-rendered composition, small client navigation disclosure, scoped CSS and regression tests.
- `src/lib/storefront-catalogue.ts`, `src/lib/storefront-routes.ts`: presentation metadata gated by the real registry and shared Day 1 navigation destinations.
- `public/images/storefront/hands-temporary.webp`: approved temporary hero crop.
- `docs/storefront/`: proposed contract, asset provenance and this review description.
- `scripts/verify-home-collection.mjs`, `artifacts/home-collection/day-1/`: reproducible Chrome QA, screenshots and results.

## Official brand assets reused

Unmodified forest wordmark, forest/sand emblems through `BrandLogo`; `Container`, `SectionHeading` and `Button`; existing Forest/Sand/Sage/Terracotta/Charcoal tokens, Playfair Display and Inter. Root favicon, manifest and corporate OG asset remain intact. The sample card uses the already licensed sample-cover photograph.

## Routes and Developer B coordination

@SooryaDayal: please review and confirm `docs/storefront/route-catalogue-contract-v0.1.md`, especially future `/create/[template]`, catalogue identity and authoritative INR price/availability ownership. **Agreement remains pending; it is not claimed as completed.**

Today `/`, `/#templates`, `/#how-it-works`, `/#contact` and existing `/demo/afterglow` are live destinations. `/demo/heirloom` remains a compatible alias/sample route, not an additional registered product. `/templates`, `/create/[template]`, `/studio/[id]`, `/checkout/[id]` and `/i/[slug]` are documented future contracts with no dead links or new backend implementations. Prices and create destinations remain null. The cinematic prototype is excluded.

## Screenshots

Actual production Chrome captures are in `artifacts/home-collection/day-1/`:

- `01-home-desktop-1440.png`
- `02-home-mobile-390.png`
- `03-home-mobile-320.png`
- `04-header-mobile-menu.png`
- `05-template-section-scaffold.png`
- `06-footer-mobile.png`

## Validation

- `npm ci`, lint, Prettier, TypeScript: passed.
- Full default Vitest run: **163 tests, 9 files passed**, including all prior suites and 7 new storefront regressions.
- Production Turbopack build: passed on retry after the existing Next.js security-advisory interruption.
- Production Chrome: 320, 375, 390, 430, 768 and 1440px; mobile keyboard/touch menu, skip/focus, real anchors and Back, hero crop and image loading, loaded fonts, zero overflow, no recorded console/hydration errors, measured CLS 0.
- Reduced motion and core content/footer navigation with JavaScript disabled checked.

## Existing demo regressions

Both demo routes passed at 320/1440: immediate sample, invalid and valid personalization, reset/reload, watermark and no overflow. Storefront UI is scoped away from invitation routes. Canonical schema and renderer behavior remain unchanged.

## Known limitations / release gates

- Owner approved the supplied hands crop temporarily on 19 November. Storefront image rights/high-resolution replacement must be confirmed before public release; see asset notes.
- Public customer-contact channel is not supplied; contact links reach an honest unavailable notice.
- Developer B route/catalogue agreement is still pending.
- Installation reports 8 moderate audit findings and an ESLint version deprecation; existing Next.js security advisory requires separate maintenance. Dependencies were not changed to hide warnings.
- Physical mobile devices, Safari and assistive-technology speech output were not tested.
- No Day 2 carousel, standalone catalogue, auth, purchases, payments, storage or publication.

## Remaining Day 2 work

Keep this PR **draft** and continue on the same branch: complete the horizontal carousel and `/templates` catalogue, activate that route only when implemented, settle the contract with Developer B, then request peer review. Do not merge the Day 1 slice today.
