# QA Report — Customer Portal SEO / Accessibility Revision

Date: 2026-09-02  
Scope: `portal` Vite implementation and parallel Next metadata/component files

## Fixes applied

- Added a programmatic, visible label (`相談内容`) associated with the consultation textarea.
- Added `role="alert"` and `role="status"` for error and completion notices.
- Added visible keyboard focus styles for links, buttons, inputs, and textareas.
- Improved muted, eyebrow, and form-border colors for clearer contrast.
- Added title, description, canonical URL, Open Graph metadata, Twitter card metadata, and `noindex, nofollow, noarchive` to the Vite HTML document.
- Added matching metadata, canonical URL, Open Graph metadata, Twitter metadata, and no-index robots directives to the Next layout.

## Automated checks

| Check | Result | Evidence |
|---|---|---|
| Type check (`npm run lint`) | PASS | Completed with `tsc --noEmit`. |
| Diff whitespace (`git diff --check`) | PASS | No output / no whitespace errors. |
| Dependency install (`npm ci`) | BLOCKED | npm returned `EUSAGE` despite a committed lockfile; dependencies are absent. |
| Production build (`npm run build`) | BLOCKED | Cannot resolve `vite`, `@vitejs/plugin-react`, and `vite/client` because dependencies are absent. |
| E2E / browser console | BLOCKED | No runnable local build or browser runner is available in this environment. |
| Deployed-page inspection | BLOCKED | `akinael-ai.com` DNS resolution is unavailable in this environment. |

## Static DOM / metadata review

- The Vite document has one Japanese-language document title and description.
- The portal is intentionally excluded from indexing because it is an authenticated customer portal.
- The consultation textarea has an associated `label[for="consultation-draft"]` and `textarea#consultation-draft`.
- User-triggered controls retain native semantic elements (`button`, `a`, `input`, `textarea`).
- CSS defines `:focus-visible` outlines for every interactive element type present in the portal.

## Required revalidation before release

Run from `portal` in an environment that can install dependencies and launch a browser:

1. `npm ci`
2. `npm run lint && npm run build`
3. Start the built portal and inspect the final DOM for title, description, robots, canonical, OGP, label association, and focus styles.
4. Test 360x800, 375x812, 390x844, 430x932, 768x1024, 1024x768, 1280x800, and 1440x900. Confirm no horizontal overflow, clipped text, or inaccessible controls.
5. Keyboard-test authentication fields, the consultation textarea, all send buttons, and links; capture screenshots and browser-console output.

## Status

**FAIL (environment-blocked):** Code-level reviewer findings are addressed, but the required production-build and real-browser evidence cannot be generated in this sandbox. Do not treat this report as release approval.
