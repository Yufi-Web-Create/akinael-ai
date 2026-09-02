# QA Report — Customer Portal SEO / Accessibility Revision

Date: 2026-09-02  
Scope: `portal` Vite implementation (the only configured build target)

## Implementation decision

- The distributable is the Vite application: `package.json` runs `vite` for development, production build, and preview.
- Removed unconfigured parallel Next.js files. They were not referenced by a build script and could not be the final DOM.
- This authenticated customer portal does not display FAQ content. It also emits no `FAQPage` JSON-LD; therefore no visible FAQ/structured-data mismatch exists. FAQ structured data is intentionally not added for content that is not present.

## SEO / accessibility review

| Requirement | Result | Evidence |
|---|---|---|
| Japanese document language, title, description | PASS (static) | `index.html` declares `lang="ja"`, title and description. |
| Authenticated portal not indexed | PASS (static) | `robots` is `noindex, nofollow, noarchive`. |
| Canonical and Open Graph metadata | PASS (static) | `index.html` contains canonical, `og:title`, `og:description`, `og:type`, and `og:url`. |
| Heading and landmark | PASS (source) | The application uses one page `h1`, section headings, and a semantic `main`. |
| Form labels and status messages | PASS (source) | Inputs have accessible labels; the textarea has `<label for="consultation-draft">`; errors use `role="alert"`; notices use `role="status"`. |
| Keyboard focus | PASS (source) | `:focus-visible` outline covers links, buttons, inputs, and textarea. |
| FAQ schema parity | PASS (source) | Neither visible FAQ content nor FAQ structured data is emitted. |

## Commands executed

| Command | Result | Notes |
|---|---|---|
| `node -e "JSON.parse(require('fs').readFileSync('package-lock.json'))"` | PASS | The committed lockfile is syntactically valid JSON. |
| `npm ci --offline --ignore-scripts --no-audit --no-fund` | BLOCKED | Fails with `ENOTCACHED` for `@types/react`: the sandbox has neither registry DNS nor a populated npm cache. It no longer fails because the lockfile is truncated/unparseable. |
| `npm run lint` / `npm run build` | BLOCKED | Cannot run until dependencies can be installed. |
| Chromium headless | BLOCKED | Chromium aborts before launch because its Crashpad handler cannot create the required sandbox socket (`Operation not permitted`). |

## Browser matrix

The required 360x800 through 1440x900 matrix has **not** been marked PASS. The runnable production bundle cannot be produced in this sandbox because registry DNS is unavailable, and the available Chromium binary fails during its own initialization. No screenshots were produced; no browser evidence is claimed.

## Required release revalidation

Run in an environment with npm registry access and a working browser sandbox:

1. `cd portal && npm install --package-lock-only --ignore-scripts` to finish resolving the pinned dependency graph, then commit the generated lockfile.
2. `npm ci && npm run lint && npm run build`.
3. Serve `dist/` and capture the eight required viewports: 360x800, 375x812, 390x844, 430x932, 768x1024, 1024x768, 1280x800, and 1440x900.
4. Verify keyboard traversal, visible focus, no horizontal overflow or clipped controls, and browser console output on the final Vite DOM.

## Status

**FAIL — environment-blocked.** The stale implementation ambiguity and FAQ/schema mismatch concern are resolved in source. Release approval remains blocked only by the unresolvable dependency-install and browser-runtime environment; the viewport matrix and production build must be re-run outside this sandbox.
