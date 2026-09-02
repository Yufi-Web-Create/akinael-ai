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

## Copy-review revision — `expanded_copy_review`

**Scope:** `public/index.html`, `public/assets/logos/logo-horizontal.svg`

| Review finding | Resolution |
|---|---|
| Generic logo tagline | Replaced in the header, footer, and reusable horizontal logo with `Web担当者がいない店舗の、集客・Web改善を支援。` |
| Unsupported `24時間` reception claim | Replaced with the function-specific `相談内容はいつでも入力できます。` |
| Unverified “frequently consulted” claim in the industry FAQ | Replaced visible FAQ and FAQ structured data with the documented target-customer definition. |
| Ambiguous approval condition | Specified `契約、課金、公開など、承認が必要な場面` as the cases requiring customer judgment. |

| Command | Result |
|---|---|
| `node --test test/public-a11y.test.mjs test/public-visual-regression.test.mjs test/customer-web-template.test.mjs test/portal-seo-a11y.test.mjs` | PASS — 4 files, 0 failures |
| Copy / FAQ JSON-LD consistency check | PASS |
| `git diff --check` | PASS |
| `npm test` | Environment-blocked: 14 test files passed; `test/platform-server.test.mjs` cannot bind `127.0.0.1` under the sandbox policy. |

The real-browser review remains blocked by the same sandbox Crashpad startup restriction recorded above. No screenshot or browser-console result is claimed for this copy-only revision.

## Judgment rationale

- The implementation cause of the reported blank sections is removed, and a focused automated regression guard now covers it.
- The sandbox prevents both a local server binding and browser startup, so its failure must remain distinct from the corrected page defect.
- No deployment, DNS change, charge, or other irreversible action was performed.

## Copy-review revision — final copy conditions

**Scope:** `public/index.html`, `public/assets/logos/logo-horizontal.svg`, `test/public-a11y.test.mjs`, `test/server.test.mjs`

| Review finding | Resolution |
|---|---|
| Abstract hero copy | Replaced with a direct statement of the audience and service: small shops without a Web manager can consult about customer acquisition, SNS, and Web improvement. |
| Unsupported ongoing-improvement promise | Replaced with a conditional statement: scope, frequency, and fee are confirmed in the contract before updates or continuing improvement proceed. |
| Prices without approved tax treatment | Removed all public price claims. The pricing section and FAQ now state that fees, tax display, and contract terms are under final confirmation and will not be published as formal prices beforehand. |
| CTA does not match the authentication flow | Updated every registration CTA to `無料登録して相談を始める` and states the required email confirmation and login step adjacent to the CTA. |
| Ambiguous free-trial scope | Replaced unconditional trial claims with a statement that the scope of a trial or paid work is confirmed after reviewing the request. |
| Public chat and my-page roles conflated | Separates the public-page guidance from project-specific consultation and status viewing in the registered my page. |

| Command | Result |
|---|---|
| `node --test test/public-a11y.test.mjs` | PASS — 3 tests, including FAQ JSON-LD and final-copy regression coverage |
| All non-listener Node tests (15 files) | PASS — 0 failures |
| `node --check test/server.test.mjs` | PASS |
| `git diff --check` | PASS |
| `test/server.test.mjs` / `test/platform-server.test.mjs` | BLOCKED — the sandbox forbids a local listener; their test setup cannot bind `127.0.0.1`. |

The browser matrix remains **BLOCKED**, not PASS. Chromium headless exits during Crashpad startup with `setsockopt: Operation not permitted`, before opening the page. No screenshot or console result is claimed. Run the server-backed tests and eight-viewport browser matrix in a browser-capable environment before release approval.

## Copy-review revision — `expanded_copy_review`

**Scope:** `public/index.html`, `public/assets/styles.css`, `test/public-a11y.test.mjs`

| Independent-review finding | Resolution |
|---|---|
| Hero copy and registration CTA did not explain the actual post-registration path | The hero now identifies the audience and service as a Web-production/customer-acquisition consultation point for small shops without a Web manager. Every visible registration CTA says `無料登録して相談をはじめる`; the hero, final CTA, FAQ, and flow state the required sequence: free registration → email confirmation → login → enter the consultation. |
| Continued updates/improvement conditions were dispersed | The service, flow, and eligible monthly-plan cards now state that continued work occurs only within the contract’s pre-confirmed scope, response count, production volume, and fee. |
| Trial and Web-site prototype wording differed by location | The hero, flow, trial card, final CTA, FAQ, JSON-LD, and showcase consistently state that the Web-site prototype is considered after the consultation is reviewed and is offered only when support is possible; its scope and production volume are then provided. |
| Advertising tax relationship was hard to compare | The advertising section now uses three visible, separate items: ad spend is tax-exclusive and paid separately to the platform; the management fee is 20% of tax-exclusive ad spend plus consumption tax; its minimum is ¥5,500/month including tax. |

### Acceptance evidence

| Check | Result |
|---|---|
| `node --test test/public-a11y.test.mjs` | PASS — authentication/FAQ semantic checks, FAQ JSON-LD parity, and strengthened final-copy regression conditions. |
| `node --test test/public-visual-regression.test.mjs` | PASS — landing-page rendering guard remains covered. |
| `git diff --check` | PASS — no whitespace errors. |
| `npm test` | BLOCKED by sandbox listener policy: all tests reached before `test/platform-server.test.mjs` passed; that file fails before assertions because the sandbox rejects local `listen` with `EPERM`. |
| Real-browser viewport matrix | BLOCKED by sandbox browser policy: Chromium aborts during Crashpad startup (`setsockopt: Operation not permitted`) before opening a page or producing screenshots. |

### Judgment rationale

- All four major findings are resolved in the rendered source, including the structured FAQ data that must mirror the visible FAQ.
- The dedicated regression assertions now protect the exact registration sequence, prototype condition, continuing-work preconditions, and the three-part advertising fee/tax relation.
- No prices, service claims, or contractual conditions were invented; the wording follows the formal entries in `src/business-config.mjs`.

### Unresolved items / next handoff

- The release gate is **not yet PASS**: run the complete Node suite and the required eight-viewport browser matrix in an environment that permits local listeners and browser IPC. Capture screenshots and console output there before requesting public-release approval.
- No deployment, DNS, billing, external submission, or other irreversible operation was performed.

## Technical-review revision — `expanded_technical_review`

**Scope:** `src/platform-api.mjs`, `src/platform-server.mjs`, `src/server.mjs`, `public/index.html`, `public/legal.html`, `public/assets/app.js`, and related regression tests.

| Independent-review finding | Resolution |
|---|---|
| New registration and consultation accepted personal data while the terms and privacy policy were still placeholders; browser-only consent could be bypassed. | Removed all new-registration and public-consultation inputs from the rendered page. The production entry server rejects legacy and v2 registration, public chat, project creation, request, message, and onboarding write endpoints with `503 consultation_intake_closed` before a body is read or a provider is called. |
| A signup/login access token could be used without verifying email confirmation. | Every authenticated v2 route calls Supabase `/auth/v1/user` server-side and requires `email_confirmed_at`. An unconfirmed email receives `403 email_confirmation_required`; login returns no token and no customer provisioning occurs. |
| Published text implied that a formal privacy policy governed active intake. | The legal page and all primary CTAs now state that new intake is stopped until formal terms, privacy policy, and consent-record design are ready. Existing-customer login remains available. |

### Automated checks

| Command | Result |
|---|---|
| `node --test test/public-a11y.test.mjs test/public-visual-regression.test.mjs test/customer-web-template.test.mjs test/portal-seo-a11y.test.mjs test/supabase-admin.test.mjs test/platform-store.test.mjs test/platform-requests.test.mjs test/production-pipelines.test.mjs test/production-router.test.mjs` | PASS — 9 files, 0 failures |
| `node --check src/platform-api.mjs src/platform-server.mjs src/server.mjs public/assets/app.js` | PASS |
| `git diff --check` | PASS |
| `npm --prefix portal run lint` / `npm --prefix portal run build` | BLOCKED — `portal/node_modules` is absent. `npm --prefix portal ci` could not complete in this restricted environment, so Vite and its type definitions are unavailable. |
| `npm test`, `test/server.test.mjs`, `test/platform-server.test.mjs` | BLOCKED — sandbox policy rejects local `listen` with `EPERM` before server-backed assertions run. |

### Browser verification

The required real-browser matrix remains **BLOCKED**, not PASS. This environment cannot start Chromium (Crashpad fails with `setsockopt: Operation not permitted`) and cannot bind a local test server. No screenshots or console results are claimed.

### Judgment rationale

- Suspending collection is the safe release-gate response while formal legal documents and consent persistence have not been supplied; it avoids inventing legal content or retaining unverifiable consent.
- Server-side endpoint rejection prevents API callers from bypassing the removed UI.
- Confirmation checks are enforced against the Supabase user record, rather than relying on the presence of an access token.

### Unresolved items / next handoff

- Before reopening intake, provide approved terms and privacy policy, define a versioned and durable consent record (user, document versions, timestamp, source), and implement the accompanying server-side validation and migration.
- In a browser-capable environment, install portal dependencies from the lockfile, run the full suite, and verify all required viewports with screenshots and console capture.
- Release approval remains unavailable until those gates pass. No deployment, DNS, billing, or external submission was performed.
