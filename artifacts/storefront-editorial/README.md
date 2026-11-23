# Storefront visual review

The checked-in evidence uses the default production build and its forest hero. The approved photo candidate is available for local review using the supplied six WebPs. [Local review and provenance](../../docs/storefront/cinematic-editorial.md)

| Moment                     | Desktop                                            | Mobile                                           |
| -------------------------- | -------------------------------------------------- | ------------------------------------------------ |
| Arrival                    | [1440 × 900](public/hero-1440.png)                 | [390 × 844](public/hero-390.png)                 |
| Statement midway           | [50%](public/statement-1440-50.png)                | [50%](public/statement-390-50.png)               |
| Featured Afterglow         | [Desktop](public/afterglow-1440.png)               | [Mobile cover](public/afterglow-cover-390.png)   |
| Forward and reverse motion | [Desktop WebM](public/storefront-scroll-1440.webm) | [Mobile WebM](public/storefront-scroll-390.webm) |

[Full statement on mobile](public/statement-390-100.png), [desktop closing](public/closing-1440.png), [keyboard menu](public/menu-keyboard-390.png), [reduced motion](public/reduced-motion-390.png) and [JavaScript disabled](public/no-js-390.png).

## Validation

Production Chrome 157 covered both builds at 320 × 568, 390 × 844, 430 × 932, 768 × 1024, 1440 × 900 and 1920 × 1080. Playwright WebKit additionally checked the photographic build at 390 × 844 and 1440 × 900. Chrome checks covered 200% CSS zoom and an equivalent 720 CSS-pixel reflow at 2×, keyboard, touch, direct anchor reload and Back. The five words retained their geometry and reversed at the same opacity values. Both live sample routes and the existing personalization editor retained the demo watermark.

The local photographic runs requested one crop each. Selected source files were 44,700–72,834 bytes in the portrait viewports and 199,034 bytes at the tested desktop sizes. Chrome measured zero cumulative layout shift and 60–132 ms LCP on loopback. These are local measurements. Sampled contrast for photograph-overlay text was at least 6.12:1 across the six widths, and the desktop axe scan found zero violations for its configured WCAG A/AA rules.

Studio sign-in, draft creation, photo upload, save, reload, version conflicts and owner-only access passed in Chrome with disposable PostgreSQL and local Supabase and signed-storage transports. Hosted providers were unavailable for verification.

[Default build viewport and motion measurements](public/results-chromium.json).
