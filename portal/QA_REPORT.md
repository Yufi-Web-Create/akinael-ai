# QA Report — Customer Portal / Legacy API Revision

Date: 2026-09-02

Scope: production HTTP entrypoint, v2 customer portal source, and reproducible portal build verification.

Tested revision: `a4efca3e6d429861ab3243b6962dbab0e7e2c5b3` plus the uncommitted changes listed in this report.

Status: **INCOMPLETE — legacy management UI exposure is fixed and release E2E is required in CI; this restricted execution environment does not permit a local TCP listener and cannot restore all portal packages, so the browser/build gate must still run in CI before release.**

## Fix applied

- The production entrypoint now returns `410 legacy_api_retired` for every legacy `/api/*` path before the legacy handler runs.
- v2 endpoints remain the only public API surface. The legacy login, customer project and message paths, public chat, and legacy administrative API are not network-reachable.
- A regression test submits representative payloads to those routes, including a customer message that would otherwise reach the legacy LLM dispatch, and verifies each is rejected at the boundary.
- README deployment and API statements now match the enforced boundary. Any future administrative migration must use a v2 management interface with strict authorization and the existing human approval gate.
- The legacy `/admin`、`/admin-login`、`/mypage` pages are now rejected by the production entrypoint with a no-store `404 legacy_management_ui_retired`; the legacy files remain repository-only migration references.
- `portal/scripts/release-e2e.mjs` serves the production entrypoint and uses Chromium to check the logged-out portal journey, browser console, internal links, and screenshots at all eight required viewports. CI builds the portal, runs this check, and uploads the screenshots.

## Executed checks

| Command | Result | Evidence |
|---|---|---|
| `npm ci` | PASS | Root dependencies restored successfully. |
| `npm test` after management/E2E additions | PASS | 19 test files passed, 0 failed, 0 skipped. Includes management-route and E2E-wiring regression tests. |
| `npm --prefix portal run lint` | PASS | TypeScript no-emit check completed successfully. |
| `npm ci --prefix portal` | BLOCKED | Registry DNS resolution failed (`EAI_AGAIN`). No `portal/node_modules` directory was created. |
| `npm ci --offline --prefix portal` | BLOCKED | Required portal tarballs are absent from the local npm cache (`ENOTCACHED`). |
| `npm --prefix portal run build` | NOT RUNNABLE | Same missing locked dependencies; no production bundle was produced. |
| `npm --prefix portal run test:e2e` | BLOCKED locally | The sandbox rejects TCP listening (`EPERM`); the same script is mandatory in GitHub Actions with a provisioned Chromium executable. |
| Browser E2E / responsive matrix | REQUIRED IN CI | Eight screenshots (360x800 through 1440x900), console output, rendered login journey, and internal-link checks are persisted as the `portal-browser-e2e` CI artifact. |
| `git diff --check` | PASS | Completed after this report update with no whitespace errors. |

## Technical-review result

| Finding | Result |
|---|---|
| Legacy customer authentication bypass | PASS — no legacy API route reaches `src/server.mjs` through `src/platform-server.mjs`. |
| Consent-unrecorded customer input sent to LLM through legacy messages | PASS — `/api/projects/:id/messages` is rejected with 410 before body processing or legacy dispatch. |
| Legacy admin API/UI reachable from the public entrypoint | PASS — `/api/admin/*` is rejected with 410 and `/admin`, `/admin-login`, `/mypage` are not published. |
| Portal build and browser evidence | PENDING CI — lint, production build, and Chromium E2E are mandatory workflow steps and must pass before release. |

## Release judgment

Do not request public-release approval yet. The management UI/API regression is resolved in source and covered by automated tests, but the required portal lint/build/E2E checks remain a release blocker until the mandatory CI run passes and its browser artifact is reviewed.
