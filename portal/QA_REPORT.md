# QA Report — Customer Portal / Legacy API Revision

Date: 2026-09-03

Tested revision: `ea2816c59e1ffaf9e50ae7a3e26f58aae3a14465`

Status: **PASS — Core Quality run `33725121125` completed the full release gate successfully, including authenticated Chromium E2E across all eight required viewports.**

## Corrections applied

- The CI workflow now executes `npm --prefix portal test` after Portal dependency restoration and before lint, build, and browser E2E.
- The authenticated journey is driven by a test-only script injected by the loopback fixture into the production build: it fills the rendered React login form, submits it, waits for the protected project, and performs a full navigation reload. The reloaded page must render the protected project without another login submission and marks the DOM as restored, proving same-process session-cookie restoration.
- Chromium CLI `--dump-dom`, stderr console capture, and `--screenshot` provide deterministic hosted-runner evidence without relying on a remote-debugging endpoint that hosted Chrome did not expose.
- The layout observer writes its evidence attribute only when the overflow result changes, preventing self-triggered mutation loops during virtual-time execution.
- For every required viewport the E2E verifies authenticated Portal content, cookie-session restoration, authenticated Portal API paths with no browser `Authorization` header, horizontal overflow, runtime/console errors, broken internal links, and screenshot output.
- The E2E serves only the production build directory (`public/portal`) and fails before running if the build output is absent. Its loopback fixture deliberately omits `Secure` only because the browser test runs over HTTP; the production API cookie attributes are separately covered by API regression tests.

## Current evidence

| Check | Result | Evidence |
|---|---|---|
| Full repository suite | PASS | Core Quality run `33725121125`: 99 passed, 0 failed, 0 skipped |
| Portal script tests | PASS | Core Quality run `33725121125`: 3 passed, 0 failed |
| E2E contract regression | PASS | Included in `npm test` (`test/portal-browser-e2e.test.mjs`) |
| Portal lint/typecheck | PASS | Core Quality run `33725121125`, revision `ea2816c59e1ffaf9e50ae7a3e26f58aae3a14465` |
| Portal production build | PASS | Core Quality run `33725121125`, revision `ea2816c59e1ffaf9e50ae7a3e26f58aae3a14465` |
| Chromium authenticated E2E | PASS | Core Quality run `33725121125`; artifact `portal-browser-e2e` ID `9881679316`, eight screenshots, digest `sha256:9e452ff6448a3980a7e43f82d4cea24700b41d762bce5632efaf62c617b2e9b2` |

## Executed CI sequence

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

Core Quality run `33725121125` passed the complete release gate on revision `ea2816c59e1ffaf9e50ae7a3e26f58aae3a14465`. It restored dependencies, passed all repository and Portal tests, passed lint/typecheck and production build, performed authenticated cookie restoration in Chromium, checked eight viewports for overflow and console errors, and uploaded all eight screenshots. The technical release judgment is PASS. No public release, DNS change, paid action, or data deletion was performed.
