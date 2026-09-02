# QA Report — expanded_seo_a11y_review

**Tested revision:** `e34847b` plus the working-tree changes in this task  
**Test date:** 2026-09-02 UTC  
**Test target:** `public/index.html`

## Fix applied

- Synced the `FAQPage` JSON-LD with all 11 rendered FAQ entries, including their order, questions, and answers.
- Marked the FAQ expansion glyph as `aria-hidden`, so it is not announced as part of each question.
- Added an automated assertion that parses the final FAQ DOM and the JSON-LD and requires exact equality. Future changes to either source fail the test until both are synchronized.

## Automated checks

| Check | Result | Evidence |
|---|---|---|
| FAQ JSON-LD / final DOM exact match | PASS | `node --test test/public-a11y.test.mjs` |
| Public SEO and keyboard landmark checks | PASS | `node --test test/public-a11y.test.mjs` |
| All runnable repository tests | PASS | 12 test files / 0 failures (all except the environment-blocked server suite) |
| Full `npm test` | Environment-blocked | `test/platform-server.test.mjs` cannot bind `127.0.0.1`: `listen EPERM` (5 failures); all other 12 files pass |

## Browser and responsive review

The required browser matrix could not be executed in this sandbox, so no screenshots are claimed as evidence.

| Required viewports | Result | Blocking environment evidence |
|---|---|---|
| 360x800, 375x812, 390x844, 430x932, 768x1024, 1024x768, 1280x800, 1440x900 | NOT RUN | Local server startup fails with `listen EPERM`; Chromium fails to create its headless user-data container; Firefox headless exits with a segmentation fault. |

Required follow-up in an environment that permits local browser execution: run the eight-viewport matrix against the served page and record screenshots, horizontal-overflow checks, keyboard focus traversal, FAQ expand/collapse behavior, and console errors.

## Status

The FAQ structured-data finding is resolved and guarded by automated regression coverage. The release gate remains **not ready for final PASS** until the required real-browser viewport evidence is collected; this is an execution-environment limitation, not an identified implementation defect.
