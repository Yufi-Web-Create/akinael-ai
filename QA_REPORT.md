# QA Report — Landing Page Visual Review Revision

**Date:** 2026-09-02 UTC
**Tested revision:** working tree after `e9467d1`
**Scope:** `public/index.html`, `public/assets/styles.css`, `public/assets/app.js`

## Fix applied

The reported blank sections were caused by the shared `.reveal` class. Its original rule made all marked content transparent until `IntersectionObserver` had run. A later override still allowed the JavaScript-enabled state to hide content, so full-page captures could reproduce the failure.

The hidden reveal states have been removed. All sections now render with `opacity: 1` and no transform whether JavaScript runs, scrolling occurs, or observer setup fails. The observer may retain the harmless `visible` marker, but it no longer controls content rendering.

## Automated checks

| Command | Result |
|---|---|
| `node --test test/public-a11y.test.mjs test/public-visual-regression.test.mjs test/customer-web-template.test.mjs` | PASS — 3 files, 0 failures |
| `git diff --check` | PASS |
| `npm test` | Environment-blocked: 14 test files passed, including the affected visual-regression test; `test/platform-server.test.mjs` cannot bind its local listener under the sandbox policy. |

The updated regression test rejects any `.reveal` or `.js .reveal` rule that sets `opacity: 0` or `visibility: hidden`.

## Real-browser visual review

| Viewport | Status | Evidence |
|---|---|---|
| 360×800 | BLOCKED | Chromium headless aborts before opening the file: Crashpad `setsockopt: Operation not permitted` (exit 134). |
| 375×812 | BLOCKED | Same browser startup restriction; no valid browser session is available. |
| 390×844 | BLOCKED | Same browser startup restriction; no valid browser session is available. |
| 430×932 | BLOCKED | Same browser startup restriction; no valid browser session is available. |
| 768×1024 | BLOCKED | Same browser startup restriction; no valid browser session is available. |
| 1024×768 | BLOCKED | Same browser startup restriction; no valid browser session is available. |
| 1280×800 | BLOCKED | Same browser startup restriction; no valid browser session is available. |
| 1440×900 | BLOCKED | Same browser startup restriction; no valid browser session is available. |

**Visual Review status: BLOCKED, not PASS.** No screenshot is claimed without a successfully running browser.

## Handoff

In a browser-capable preview environment, inspect the landing page at all eight required viewports. Confirm each formerly hidden section is visible in the initial full-page capture, then verify no horizontal overflow, navigation/CTA access, image crop, focus visibility, FAQ expansion, dialog containment, and floating-chat overlap. Retain the screenshots and console output before marking the visual review PASS.

## Judgment rationale

- The implementation cause of the reported blank sections is removed, and a focused automated regression guard now covers it.
- The sandbox prevents both a local server binding and browser startup, so its failure must remain distinct from the corrected page defect.
- No deployment, DNS change, charge, or other irreversible action was performed.
