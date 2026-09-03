# QA Report — Customer Portal / Legacy API Revision

Date: 2026-09-03

Tested revision: pending the Core Quality run triggered by this correction.

Status: **PENDING — the complete Core Quality sequence now includes the previously missing Portal script-test step and requires a fresh CI run before the release gate can pass.**

## Corrections applied

- The CI workflow now executes `npm --prefix portal test` after Portal dependency restoration and before lint, build, and browser E2E.
- The browser E2E no longer stops at the unauthenticated login screen. For every required viewport it uses Chromium DevTools to render and submit the login form, verify authenticated Portal content, reload and verify cookie-session restoration, verify authenticated Portal API paths use the session cookie and no browser `Authorization` header, and fail on horizontal overflow, runtime/console errors, broken internal links, or missing screenshot output.
- The E2E serves only the production build directory (`public/portal`) and fails before running if the build output is absent. Its loopback fixture deliberately omits `Secure` only because the browser test runs over HTTP; the production API cookie attributes are separately covered by API regression tests.

## Current evidence

| Check | Result | Evidence |
|---|---|---|
| Full repository suite | PASS | `npm test`: 20 passed, 0 failed, 0 skipped |
| Portal script tests | PASS | `npm --prefix portal test`: 1 passed, 0 failed |
| E2E contract regression | PASS | Included in `npm test` (`test/portal-browser-e2e.test.mjs`) |
| Portal lint/typecheck | PASS (historical) | Core Quality run `33696822670`, revision `a7883d5ebbb253206d4b9970b767b0972d30bf04` |
| Portal production build | PASS (historical) | Core Quality run `33696822670`, revision `a7883d5ebbb253206d4b9970b767b0972d30bf04` |
| Chromium authenticated E2E | PASS (historical) | Core Quality run `33696822670`; artifact `portal-browser-e2e` ID `9872079676`, eight screenshots, digest `sha256:81516b13e2267a86945bbd99baf35e2c77c2c13bdc2f78bce6d48ec394c8ec9c` |

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

Run `33696822670` proves that dependency restoration, production build, and authenticated Chromium E2E are executable in Core Quality, but it predates the newly added Portal script-test gate. A fresh passing run on this correction is still required. No public release, DNS change, paid action, or data deletion was performed.
