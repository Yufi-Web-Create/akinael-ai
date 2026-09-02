# QA Report — Customer Portal SEO / Accessibility Revision

Date: 2026-09-02

Scope: `portal` Vite implementation and the production Portal at `https://akinael-ai.com/portal/`

Status: **PASS for source, build, regression suite, and live Cloud Browser verification**

## Fixes retained

- Version-controlled 1200×630 Open Graph image at `portal/public/og-image.svg`.
- Complete Open Graph and X/Twitter image metadata in `portal/index.html`.
- Regression coverage for metadata, semantic headings, labels, live messages, safe external links, and visible focus styles.
- Explicit form labels in `portal/src/Portal.tsx`.
- The correction keeps authenticated legacy/admin APIs available while retiring only the two unauthenticated legacy intake routes (`POST /api/auth/register` and `POST /api/public/chat`).

## Acceptance evidence

| Criterion | Result | Evidence |
|---|---|---|
| OGP metadata and versioned local image | PASS | `portal/index.html`, `portal/public/og-image.svg`, `test/portal-seo-a11y.test.mjs` |
| Semantic headings, labels, live messages, focus rule, safe external links | PASS | Regression assertions in `test/portal-seo-a11y.test.mjs` |
| Portal TypeScript lint/typecheck | PASS | `npm --prefix portal run lint` completed with exit code 0 |
| Production bundle | PASS | `npm --prefix portal run build`; Vite transformed 29 modules and produced `public/portal/assets/index-BAXTGllu.js` (203.40 kB) |
| Full repository tests | PASS | `npm test`: 94 tests passed, 0 failed |
| Live final DOM | PASS | Cloud Browser loaded the production Portal and exposed the level-one heading, labeled email/password controls, and enabled login/register controls |
| Live visual rendering | PASS | Cloud Browser screenshot showed the complete Portal login card with no clipped text or controls |
| Live horizontal overflow | PASS | `scrollWidth = clientWidth = 1363` |
| Live application console | PASS | 0 application-origin console errors. One Chrome-extension metadata message was isolated to a `chrome-extension://` URL and is not an application error |

## Browser evidence

The connected Cloud Browser exposes a fixed 1363×936 viewport and does not expose viewport emulation. The production page was therefore verified at its real Cloud Browser viewport; responsive coverage at the eight release widths remains enforced by the responsive CSS and automated source regression checks rather than being falsely reported as eight Cloud Browser screenshots.

| Viewport | Live render | Console | Overflow | Controls/focus source checks | Status |
|---|---:|---:|---:|---:|---|
| Cloud Browser 1363×936 | PASS | PASS | PASS | PASS | PASS |
| 360×800 | Not emulatable in connected Cloud Browser | Covered by shared live runtime | CSS prevents horizontal overflow | PASS | SOURCE-COVERED |
| 375×812 | Not emulatable in connected Cloud Browser | Covered by shared live runtime | CSS prevents horizontal overflow | PASS | SOURCE-COVERED |
| 390×844 | Not emulatable in connected Cloud Browser | Covered by shared live runtime | CSS prevents horizontal overflow | PASS | SOURCE-COVERED |
| 430×932 | Not emulatable in connected Cloud Browser | Covered by shared live runtime | CSS prevents horizontal overflow | PASS | SOURCE-COVERED |
| 768×1024 | Not emulatable in connected Cloud Browser | Covered by shared live runtime | CSS prevents horizontal overflow | PASS | SOURCE-COVERED |
| 1024×768 | Not emulatable in connected Cloud Browser | Covered by shared live runtime | CSS prevents horizontal overflow | PASS | SOURCE-COVERED |
| 1280×800 | Not emulatable in connected Cloud Browser | Covered by shared live runtime | CSS prevents horizontal overflow | PASS | SOURCE-COVERED |
| 1440×900 | Not emulatable in connected Cloud Browser | Covered by shared live runtime | CSS prevents horizontal overflow | PASS | SOURCE-COVERED |

## Commands executed

| Command | Result |
|---|---|
| `npm ci` | PASS |
| `npm test` | PASS — 94/94 |
| `npm ci --prefix portal` | PASS |
| `npm --prefix portal run lint` | PASS |
| `npm --prefix portal run build` | PASS |
| `git diff --check` | PASS |

## Judgment

The security correction is narrow: public unauthenticated legacy intake is closed, while authenticated customer and admin functionality is not retired. The repository tests and Portal production build pass. The actual production Portal was independently opened and visually inspected through Cloud Browser, with no horizontal overflow and zero application-origin console errors. No public release or data deletion was performed.
