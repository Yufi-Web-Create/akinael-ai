# QA report — 2026-09-16

## Automated checks

- `npm run qa`: PASS
- `curl --fail http://127.0.0.1:4173`: PASS
- Required store information, Japanese language declaration, description, one `h1`, semantic navigation, anchor targets, mobile media query, and absence of out-of-scope contact/external links: PASS
- `git diff --check`: PASS

## Browser verification

The local HTTP server started successfully. Chromium and Firefox headless screenshot runs were both attempted, but the sandbox terminates their browser processes before rendering (Chromium Crashpad socket permission failure; Firefox segmentation fault in headless mode). No browser screenshot or console inspection can therefore be recorded in this environment.

## Required follow-up before release approval

Run browser QA at 360×800, 375×812, 390×844, 430×932, 768×1024, 1024×768, 1280×800, and 1440×900, including overflow, navigation, focus, and console checks. Confirm the supplied business hours, regular closing day, and address with the store before publishing.
