# QA Report — Customer Portal SEO / Accessibility Revision

Date: 2026-09-02
Tested revision: `4918985` plus the uncommitted form-label correction in `portal/src/Portal.tsx`
Scope: `portal` Vite implementation (the configured production build target)

## Correction applied

- Replaced `aria-label`-only text fields with programmatic `<label htmlFor>` / `id` pairs for authentication, onboarding, and project creation.
- Added appropriate autofill semantics for email, password, name, and organization fields.
- Kept the existing error (`role="alert"`), status (`role="status"`), required-field, disabled-state, and `:focus-visible` behavior unchanged.

## SEO / accessibility source review

| Requirement | Result | Evidence |
|---|---|---|
| Japanese language, title, description | PASS (source) | `index.html` declares `lang="ja"`, title, and description. |
| Authenticated portal not indexed | PASS (source) | `robots` is `noindex, nofollow, noarchive`. |
| Canonical and Open Graph metadata | PASS (source) | Canonical plus `og:title`, `og:description`, `og:type`, and `og:url` are present. |
| Landmark and heading | PASS (source) | One page `main` and one page `h1`; subsequent page headings are `h2`. |
| Form labels and messages | PASS (source) | Every rendered text field has a label association; the textarea already has one. Errors and notices use live roles. |
| Keyboard focus styling | PASS (source) | `:focus-visible` outlines cover links, buttons, inputs, and textarea. |
| FAQ schema parity | PASS (source) | Neither FAQ UI nor `FAQPage` structured data is emitted by this authenticated portal. |

## Commands executed

| Command | Result | Evidence |
|---|---|---|
| `npm ci --offline --ignore-scripts --no-audit --no-fund --cache /tmp/akinael-npm-cache` | BLOCKED | `ENOTCACHED`: the required `@types/react` package is absent from the cache. |
| `npm ci --ignore-scripts --no-audit --no-fund --verbose` | BLOCKED | Registry lookup for `https://registry.npmjs.org/react` fails with `EAI_AGAIN`; network/DNS is unavailable. |
| `npm run lint` | BLOCKED | Dependencies are unavailable; TypeScript cannot resolve `vite/client`. |
| `npm run build` | BLOCKED | Dependencies are unavailable; TypeScript cannot resolve `vite` and `@vitejs/plugin-react`. |
| Source accessibility assertions | PASS | All metadata, landmarks, explicit labels, live roles, and heading assertions passed. |
| `chromium --headless=new ... --dump-dom about:blank` | BLOCKED | Chromium aborts in Crashpad before opening a page: `setsockopt: Operation not permitted`; `client.StartHandler` fails. |
| `firefox --headless --screenshot ... about:blank` | BLOCKED | Firefox headless also terminates with a core dump before producing a screenshot. |

## Browser matrix and runtime checks

The required eight viewports are **not PASS**. A production bundle could not be generated, and neither installed browser can start in this sandbox. Accordingly, no screenshots, final-DOM inspection, browser console result, horizontal-overflow result, or keyboard traversal result is claimed.

| Viewport | Screenshot | Console | Overflow | Keyboard / focus | Status |
|---|---:|---:|---:|---:|---|
| 360x800 | — | — | — | — | BLOCKED |
| 375x812 | — | — | — | — | BLOCKED |
| 390x844 | — | — | — | — | BLOCKED |
| 430x932 | — | — | — | — | BLOCKED |
| 768x1024 | — | — | — | — | BLOCKED |
| 1024x768 | — | — | — | — | BLOCKED |
| 1280x800 | — | — | — | — | BLOCKED |
| 1440x900 | — | — | — | — | BLOCKED |

## Release revalidation procedure

Run in an environment with npm registry access and an operational headless browser:

1. `cd portal && npm ci && npm run lint && npm run build`
2. Serve `dist/` with `npm run start -- --host 127.0.0.1`.
3. At all eight required viewports, capture a screenshot and record zero console errors, no horizontal overflow, reachable navigation/CTA/form controls, and visible focus during keyboard traversal.
4. Inspect the final Vite DOM for the source-reviewed metadata, landmark, heading order, and input-label associations.

## Status

**FAIL — release gate remains blocked by the execution environment.** The form-label correction is implemented and source assertions pass, but build and real-browser evidence are mandatory and remain unexecuted. No public release action was performed.
