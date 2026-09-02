# QA Report — Landing Page Visual Review Revision

Date: 2026-09-02
Scope: `public/index.html`, `public/assets/styles.css`, and `public/assets/app.js`
Status: **FAIL — real-browser visual evidence is blocked by this execution environment**

## Finding corrected

The previous visual-review evidence showed lower-page sections as blank or solid blocks. The cause was the global `.reveal` rule: it set every marked section to `opacity: 0` until `IntersectionObserver` called its callback. This made readability depend on scroll-observer execution.

The rule now uses motion as progressive enhancement:

- `.reveal` is visible by default, including when JavaScript or `IntersectionObserver` fails.
- Only the JavaScript-enhanced `.js .reveal` state begins hidden.
- The observer adds `.visible` once a section reaches the viewport, using a lower pre-entry margin for stable scrolling.

The change preserves the intended reveal animation when JavaScript works and prevents content from being hidden when it does not.

## Commands and results

| Command | Result |
|---|---|
| `node --test test/public-a11y.test.mjs test/public-visual-regression.test.mjs test/customer-web-template.test.mjs` | PASS — 3 files / all assertions passed |
| `git diff --check` | PASS |
| `npm test` | BLOCKED by the sandbox's socket policy in `test/platform-server.test.mjs`; all completed application test files, including the new visual-regression test, passed before the server test could complete. |
| Static HTTP server on `127.0.0.1:4173` | BLOCKED — `listen EPERM` |
| Chromium headless smoke run | BLOCKED — Crashpad fails at `setsockopt: Operation not permitted`, exit 134 |
| Firefox headless smoke run | BLOCKED — process exits with signal 11 |

## Required viewport matrix

No row is marked PASS without a running browser, a served page, deliberate scrolling, and retained screenshots.

| Viewport | Scroll each section into view | Screenshot | Console | Overflow / controls | Status |
|---|---|---|---|---|---|
| 360×800 | — | — | — | — | BLOCKED |
| 375×812 | — | — | — | — | BLOCKED |
| 390×844 | — | — | — | — | BLOCKED |
| 430×932 | — | — | — | — | BLOCKED |
| 768×1024 | — | — | — | — | BLOCKED |
| 1024×768 | — | — | — | — | BLOCKED |
| 1280×800 | — | — | — | — | BLOCKED |
| 1440×900 | — | — | — | — | BLOCKED |

## Handoff: required final browser check

Run the landing page from an approved browser-capable preview environment. At each viewport above, scroll through every section so that `.reveal` elements gain `.visible`, then capture the resulting viewport and full-page screenshots. Record console errors, horizontal overflow, header/menu behavior, CTA reachability, image crop, focus visibility, FAQ expansion, dialog containment, and floating-chat overlap. Only mark this review PASS after all eight rows pass.

## Judgment rationale

- The reported blank-section failure is corrected at its implementation cause and protected by a focused regression test.
- A static source test cannot replace actual viewport inspection, so the release gate remains FAIL rather than treating this revision as visually approved.
- No public release, DNS change, payment operation, or other irreversible action was performed.
