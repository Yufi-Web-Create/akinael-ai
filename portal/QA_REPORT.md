# QA Report — Customer Portal / Legacy API Revision

Date: 2026-09-03

Tested revision: pending the Core Quality run triggered by the idempotent layout-observer correction.

Status: **PENDING — Core Quality runs `33723800003` and `33724082188` passed repository tests, Portal tests, lint, and production build. Hosted Chrome did not expose a DevTools endpoint, so the E2E now uses the proven headless Chromium CLI path. Its layout observer is idempotent so its own evidence attribute cannot retrigger an endless mutation loop. A fresh CI run is required.**

## Corrections applied

- The CI workflow now executes `npm --prefix portal test` after Portal dependency restoration and before lint, build, and browser E2E.
- The authenticated journey is driven by a test-only script injected by the loopback fixture into the production build: it fills the rendered React login form and submits it. A second Chromium process reuses the same profile and must render the protected project without the injection, proving persisted-cookie restoration.
- Chromium CLI `--dump-dom`, stderr console capture, and `--screenshot` provide deterministic hosted-runner evidence without relying on a remote-debugging endpoint that hosted Chrome did not expose.
- The layout observer writes its evidence attribute only when the overflow result changes, preventing self-triggered mutation loops during virtual-time execution.
- For every required viewport the E2E verifies authenticated Portal content, cookie-session restoration, authenticated Portal API paths with no browser `Authorization` header, horizontal overflow, runtime/console errors, broken internal links, and screenshot output.
- The E2E serves only the production build directory (`public/portal`) and fails before running if the build output is absent. Its loopback fixture deliberately omits `Secure` only because the browser test runs over HTTP; the production API cookie attributes are separately covered by API regression tests.

## Current evidence

| Check | Result | Evidence |
|---|---|---|
| Full repository suite | PASS | Core Quality run `33723800003`: 99 passed, 0 failed, 0 skipped |
| Portal script tests | PASS | Core Quality run `33723800003`: 3 passed, 0 failed |
| E2E contract regression | PASS | Included in `npm test` (`test/portal-browser-e2e.test.mjs`) |
| Portal lint/typecheck | PASS | Core Quality run `33723800003`, revision `2d957bd990ab4021ec91458eb153c2f350af559d` |
| Portal production build | PASS | Core Quality run `33723800003`, revision `2d957bd990ab4021ec91458eb153c2f350af559d` |
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

Runs `33723800003` and `33724082188` prove the complete unit-test, Portal-test, lint, and production-build gates. Their browser steps timed out before Chrome exposed a DevTools endpoint; the E2E now uses the hosted-runner Chromium CLI path that previously produced screenshots successfully, extended with authenticated form submission and a separate cookie-restoration launch. A fresh passing run on this correction is still required. No public release, DNS change, paid action, or data deletion was performed.
