# QA Report — Customer Portal SEO / Accessibility Revision

Date: 2026-09-02
Scope: `portal` Vite implementation
Status: **FAIL — release gate is blocked by the execution environment**

## Fixes applied

- Added a version-controlled 1200×630 Open Graph image at `portal/public/og-image.svg`.
- Added `og:image`, secure URL, MIME type, dimensions, alternative text, and matching X/Twitter image metadata to `portal/index.html`.
- Added `test/portal-seo-a11y.test.mjs` to prevent regression of the portal metadata, OGP asset, semantic heading, label association, live-message, safe external-link, and focus-style checks.
- The prior explicit form-label correction in `portal/src/Portal.tsx` remains intact.

## Acceptance criteria and evidence

| Criterion | Result | Evidence |
|---|---|---|
| `og:image` is defined and has a versioned local asset | PASS | `portal/index.html`, `portal/public/og-image.svg` |
| OGP image has usable dimensions and alternative text | PASS | 1200×630, `og:image:alt` present |
| Title, description, canonical, noindex, and sharing metadata exist | PASS | `test/portal-seo-a11y.test.mjs` |
| Semantic heading, labels, live messages, focus rule, and safe external link are retained | PASS (source) | `test/portal-seo-a11y.test.mjs` |
| Portal production typecheck and build | BLOCKED | Required portal dependencies are unavailable |
| Final DOM, screenshots, console, overflow, and keyboard checks at 8 viewports | BLOCKED | This sandbox prohibits local listening and browser startup |

## Commands executed

| Command | Result | Details |
|---|---|---|
| `node --test test/portal-seo-a11y.test.mjs` | PASS | 2 assertions passed. |
| `npm test` | BLOCKED (unrelated test) | 14 test files passed; `test/platform-server.test.mjs` fails because the sandbox returns `listen EPERM` for `127.0.0.1`. No application assertion failed. |
| `npm --prefix portal run lint` | BLOCKED | TypeScript cannot resolve `vite/client`, `vite`, and `@vitejs/plugin-react` because portal dependencies are absent. |
| `npm --prefix portal run build` | BLOCKED | Same missing dependencies; no production bundle was produced. |
| `npm ci --prefix portal` | BLOCKED | The environment cannot reach the npm registry, and the available package cache does not contain the required portal packages. |
| Chromium headless, including `--no-sandbox` and isolated profile | BLOCKED | Chromium aborts during Crashpad startup: `setsockopt: Operation not permitted`. |
| Firefox headless with isolated profile and disabled content sandbox env vars | BLOCKED | Firefox exits with signal 11 before producing a screenshot. |
| `git diff --check` | PASS | No whitespace errors. |

## Required browser matrix

No row may be marked PASS without a production bundle and real-browser evidence.

| Viewport | Screenshot | Console | Overflow | Keyboard/focus | Status |
|---|---:|---:|---:|---:|---|
| 360×800 | — | — | — | — | BLOCKED |
| 375×812 | — | — | — | — | BLOCKED |
| 390×844 | — | — | — | — | BLOCKED |
| 430×932 | — | — | — | — | BLOCKED |
| 768×1024 | — | — | — | — | BLOCKED |
| 1024×768 | — | — | — | — | BLOCKED |
| 1280×800 | — | — | — | — | BLOCKED |
| 1440×900 | — | — | — | — | BLOCKED |

## Judgment rationale

- The OGP finding is resolved in source and protected by a dedicated automated regression test.
- The required browser evidence cannot be substituted with source inspection. The same sandbox policy that blocks browser IPC also blocks a local `127.0.0.1` listener, so neither Vite preview nor the existing server-backed tests can be exercised here.
- The release gate therefore remains FAIL; no tests were removed, skipped, or weakened, and no public release action was performed.

## Unresolved items / handoff

Run the following in a browser-capable environment with npm registry access before requesting release approval:

1. `cd portal && npm ci && npm run lint && npm run build`
2. Serve `portal/dist` locally or deploy it to an approved preview environment.
3. At all eight required viewports, capture screenshots and record final DOM metadata, zero console errors, no horizontal overflow, reachable controls, and visible keyboard focus.
4. Confirm `https://akinael-ai.com/portal/og-image.svg` is publicly served with `image/svg+xml` after the approved deployment. If a target social platform does not support SVG preview images, publish an approved raster derivative and change the two image URLs together.
