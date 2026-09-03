# QA Report — Customer Portal / Legacy API Revision

Date: 2026-09-03

Tested revision: `0a82e9df046cb54d4ec9f2d353e9d37d4f09aa02` plus the uncommitted correction recorded in this worktree.

Status: **FAIL — source/API regression tests pass; Portal dependency restoration, production build, and Chromium E2E require a fresh CI run before this release gate can pass.**

## Corrections applied

- The CI workflow now executes `npm --prefix portal test` after Portal dependency restoration and before lint, build, and browser E2E.
- The browser E2E no longer stops at the unauthenticated login screen. For every required viewport it uses Chromium DevTools to render and submit the login form, verify authenticated Portal content, reload and verify cookie-session restoration, verify authenticated Portal API paths use the session cookie and no browser `Authorization` header, and fail on horizontal overflow, runtime/console errors, broken internal links, or missing screenshot output.
- The E2E serves only the production build directory (`public/portal`) and fails before running if the build output is absent. Its loopback fixture deliberately omits `Secure` only because the browser test runs over HTTP; the production API cookie attributes are separately covered by API regression tests.

## Current local evidence

| Check | Result | Evidence |
|---|---|---|
| Full repository suite | PASS | `npm test`: 20 passed, 0 failed, 0 skipped |
| Portal script tests | PASS | `npm --prefix portal test`: 1 passed, 0 failed |
| E2E contract regression | PASS | Included in `npm test` (`test/portal-browser-e2e.test.mjs`) |
| Portal lint/typecheck | NOT RUN | Dependency restoration did not complete in this restricted workspace |
| Portal production build | NOT RUN | Dependency restoration did not complete in this restricted workspace |
| Chromium authenticated E2E | NOT RUN | Depends on a successful production build; local sandbox also blocks loopback listeners |

## Required CI evidence before a PASS judgment

Run the unchanged Core Quality sequence on the corrected revision:

```text
npm ci
npm test
npm ci --prefix portal
npm --prefix portal test
npm --prefix portal run lint
npm --prefix portal run build
npm --prefix portal run test:e2e
```

The CI artifact `portal-browser-e2e` must contain eight screenshots for the required viewport matrix: 360×800, 375×812, 390×844, 430×932, 768×1024, 1024×768, 1280×800, and 1440×900.

## Security and migration boundary verified by regression tests

- Browser code uses same-origin credentialed requests and does not store a bearer token in `localStorage` or send browser `Authorization` headers.
- v2 login and registration return no access token in JSON and set the `HttpOnly; Secure; SameSite=Lax; Path=/` session cookie in production API behavior.
- `/api/*` legacy routes return `410 legacy_api_retired` before reaching legacy customer-data handling.
- Legacy management pages return a no-store 404, preventing the retired management UI from being publicly served.

## Release judgment

The previous report's historical CI run, screenshot artifact, test count, and tested revision are not evidence for this worktree and have been removed. No public release, DNS change, paid action, or data deletion was performed. A passing CI build and authenticated Chromium run are still required for release approval.
