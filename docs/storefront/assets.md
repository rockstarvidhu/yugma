# Storefront assets and release gates

## Official identity

Reuse the unmodified `public/brand/yugma-wordmark-forest.svg`, `yugma-emblem-forest.svg`, and `yugma-emblem-sand.svg` through `BrandLogo`. Corporate Forest/Sand/Sage/Terracotta/Charcoal tokens, Playfair Display and Inter remain unchanged. Root icons and manifest remain intact.

## Temporary hero — owner approved

On 19 November 2026 the project owner explicitly approved: **“Approve the supplied hands crop temporarily.”**

`public/images/storefront/hands-temporary.webp` is a byte-for-byte copy of the existing supplied V4 clean hands crop. Source: external V4 art kit `photos/demo/demo_01_hands.jpg`, crop `(295,15,450,450)`. No code, history or assets in the cinematic checkout were changed. The hero source is 450×450 and may appear soft at large sizes. Next Image supplies responsive optimized variants; display uses 4:5 on desktop and square on mobile with joined hands kept central. Text sits beside/above the photo.

**Release gate:** temporary UI approval does not establish copyright/commercial rights or participant releases. Confirm storefront rights or replace with approved licensed/owned high-resolution photography before public release. No photography was scraped or generated for this task.

## Existing sample cover

The collection reuses `/invitations/heirloom-demo.jpg`, already used in the actual Afterglow/Heirloom sample. Existing source credit in `src/templates/internal/demo-invitation.ts`: Sabesh Photography LTD, Unsplash License, https://unsplash.com/photos/couple-in-traditional-indian-wedding-attire-in-a-garden-RIOegGLaUbE . No new template artwork is invented. Preview metadata describes the cover photograph rather than implying a separate template or an exact full-page screenshot.

No new font files, remote image allowlist, dependency or animation library is introduced. Photography preload is limited to the hero; the sample card uses lazy loading.
