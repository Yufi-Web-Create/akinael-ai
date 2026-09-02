# QA Report — Customer Portal / Legacy API Revision

Date: 2026-09-02

Scope: production HTTP entrypoint, v2 customer portal source, and reproducible portal build verification.

Tested revision: `a4efca3e6d429861ab3243b6962dbab0e7e2c5b3` plus the uncommitted changes listed in this report.

Status: **FAIL — the legacy API regression is fixed and backend tests pass; portal dependencies cannot currently be restored in this restricted environment, so portal lint, production build, and browser E2E have not passed.**

## Fix applied

- The production entrypoint now returns `410 legacy_api_retired` for every legacy `/api/*` path before the legacy handler runs.
- v2 endpoints remain the only public API surface. The legacy login, customer project and message paths, public chat, and legacy administrative API are not network-reachable.
- A regression test submits representative payloads to those routes, including a customer message that would otherwise reach the legacy LLM dispatch, and verifies each is rejected at the boundary.
- README deployment and API statements now match the enforced boundary. Any future administrative migration must use a v2 management interface with strict authorization and the existing human approval gate.

## Executed checks

| Command | Result | Evidence |
|---|---|---|
| `npm ci` | PASS | Root dependencies restored successfully. |
| `npm test` | PASS | 18 test files passed, 0 failed, 0 skipped. Includes `test/platform-server.test.mjs`. |
| `npm ci --prefix portal` | BLOCKED | Registry DNS resolution failed (`EAI_AGAIN`). No `portal/node_modules` directory was created. |
| `npm ci --offline --prefix portal` | BLOCKED | Required portal tarballs are absent from the local npm cache (`ENOTCACHED`). |
| `npm --prefix portal run lint` | NOT RUNNABLE | `vite/client`, `vite`, and `@vitejs/plugin-react` cannot resolve without the missing dependencies. |
| `npm --prefix portal run build` | NOT RUNNABLE | Same missing locked dependencies; no production bundle was produced. |
| Browser E2E / responsive matrix | NOT RUN | A local production bundle could not be built or served. No live production claim is made. |
| `git diff --check` | PASS | Completed after this report update with no whitespace errors. |

## Technical-review result

| Finding | Result |
|---|---|
| Legacy customer authentication bypass | PASS — no legacy API route reaches `src/server.mjs` through `src/platform-server.mjs`. |
| Consent-unrecorded customer input sent to LLM through legacy messages | PASS — `/api/projects/:id/messages` is rejected with 410 before body processing or legacy dispatch. |
| Legacy admin API reachable from the public entrypoint | PASS — rejected with the same 410 boundary response. |
| Portal build evidence | FAIL — cannot truthfully report a production build or browser E2E without restoring dependencies from `portal/package-lock.json`. |

## Release judgment

Do not request public-release approval yet. The legacy API security regression is resolved in source and covered by automated tests, but the required portal lint/build/E2E checks remain a release blocker. Re-run the portal commands in an environment with access to the lockfile dependencies, then serve the generated bundle and complete the required viewport/browser checks before changing this report to PASS.
