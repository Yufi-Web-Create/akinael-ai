# QA Report — Customer Portal / Legacy API Revision

Date: 2026-09-02

Tested revision: `a7883d5ebbb253206d4b9970b767b0972d30bf04`

Status: **FAIL — security fixes are implemented and source tests pass, but the current workspace cannot restore Portal build dependencies to repeat the production-build and browser gates**

## 2026-09-02 technical review correction

- The Portal no longer stores or reads a bearer token in `localStorage`, and it no longer sends an `Authorization` header from browser JavaScript.
- v2 registration and login now set `akinael_v2_session` as an `HttpOnly; Secure; SameSite=Lax; Path=/` cookie and return no access token in their JSON response. The Portal uses same-origin credentialed requests; session restoration is performed by `/api/v2/auth/me`.
- The browser console gate now detects both Chromium's `ERROR:CONSOLE(...)` resource-error form (including 404s) and alternate `CONSOLE ERROR` / `CONSOLE SEVERE` forms. The 404 form has a dedicated regression test.
- `npm test` passed: 20 test files, 0 failed. `npm --prefix portal test` passed: 3 tests, 0 failed. `npm --prefix portal run lint` passed before dependency restoration was attempted.
- `npm --prefix portal run build` could not be completed locally because the workspace lacks the Vite packages and `npm ci --prefix portal` cannot retrieve all locked packages with the available restricted network/cache. `npm --prefix portal run test:e2e` was also attempted and stopped before Chromium launch because this sandbox prohibits binding `127.0.0.1` (`listen EPERM`). Therefore no new Chromium screenshots or browser-E2E PASS evidence is claimed here.
- CI now runs `npm --prefix portal test` before lint, build, and the existing Chromium E2E job. A successful CI run is required before changing this report to PASS.

## Security and migration boundary

- The production entrypoint returns `410 legacy_api_retired` for every legacy `/api/*` path before the legacy handler can process customer data.
- v2 endpoints are the only public API surface. Supabase identity, confirmed email, tenant scope, and recorded legal consent cannot be bypassed through legacy customer routes.
- Legacy `/admin`, `/admin-login`, and `/mypage` pages return a no-store 404. Their source remains only as a migration reference until a separately reviewed v2 Admin App exists.
- Regression tests cover the legacy customer message path, public chat, login, management API, and management pages.

## Reproducible quality evidence

GitHub Actions Core Quality Run: `33696822670`

Browser evidence artifact: `portal-browser-e2e`, artifact ID `9872079676`, SHA-256 `81516b13e2267a86945bbd99baf35e2c77c2c13bdc2f78bce6d48ec394c8ec9c`

| Check | Result | Evidence |
|---|---|---|
| Root dependency restore | PASS | `npm ci` |
| Full repository suite | PASS | 96 passed, 0 failed, 0 skipped |
| Portal dependency restore | PASS | `npm ci --prefix portal` |
| Portal lint/typecheck | PASS | `npm --prefix portal run lint` |
| Portal production build | PASS | Vite 7.1.12, 29 modules, JS bundle 203.40 kB |
| Browser journey | PASS | Login heading and labeled email/password controls rendered in Chromium |
| Browser console | PASS | No `CONSOLE ERROR` or `CONSOLE SEVERE` output |
| Internal links | PASS | Every source-declared internal link returned HTTP 200 |
| Screenshot artifact | PASS | Eight PNG files uploaded by `actions/upload-artifact@v4` |

## Required viewport matrix

| Viewport | Rendered journey | Console | Screenshot | Status |
|---|---:|---:|---:|---|
| 360×800 | PASS | PASS | PASS | PASS |
| 375×812 | PASS | PASS | PASS | PASS |
| 390×844 | PASS | PASS | PASS | PASS |
| 430×932 | PASS | PASS | PASS | PASS |
| 768×1024 | PASS | PASS | PASS | PASS |
| 1024×768 | PASS | PASS | PASS | PASS |
| 1280×800 | PASS | PASS | PASS | PASS |
| 1440×900 | PASS | PASS | PASS | PASS |

## Independent live verification

The production Portal at `https://akinael-ai.com/portal/` was also opened in Cloud Browser. The visible login card, semantic heading, and labeled controls rendered successfully. The measured document had no horizontal overflow (`scrollWidth = clientWidth = 1363`), and application-origin console errors were zero. A Chrome-extension metadata message originated from `chrome-extension://` and is excluded from the application error count.

## Release judgment

FAIL pending a fresh CI production build and Chromium E2E run. No public release, production DNS change, paid action, or data deletion was performed.
