# QA Report — Customer Portal / Legacy API Revision

Date: 2026-09-02

Tested revision: `a7883d5ebbb253206d4b9970b767b0972d30bf04`

Status: **PASS — source, production build, and required browser evidence completed**

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

PASS. The legacy customer-data bypass and legacy management UI exposure are closed, the complete repository suite and Portal build are reproducible in CI, and all eight required browser viewports have persisted screenshot evidence. No public release, production DNS change, paid action, or data deletion was performed.
