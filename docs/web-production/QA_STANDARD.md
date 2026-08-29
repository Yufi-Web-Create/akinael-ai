# QA_STANDARD.md

## Principle

QAは感想ではなくRelease Gateである。

1項目でもBLOCKERが残る場合は顧客確認・公開へ進めない。
FAILは担当ロールへ差し戻し、修正後に全関連検査を再実行する。

## Severity

- `BLOCKER`: 公開不可。機能停止、重大な表示崩れ、セキュリティ、架空情報、法務・承認違反等。
- `MAJOR`: 顧客提出不可。主要viewport崩れ、不自然なコピー、主要導線不良、重要A11y不備等。
- `MINOR`: 公開判断を妨げない軽微な改善。

## Required automated checks

実装方式に応じ、利用可能な以下を必須化する。

- install succeeds
- lint
- typecheck
- unit tests
- backend/integration tests
- production build
- E2E
- browser console errors
- broken internal links

テストをskip/delete/weakeningして合格させることは禁止。

## Responsive matrix

最低viewport:

| viewport | required |
|---|---|
| 360x800 | PASS |
| 375x812 | PASS |
| 390x844 | PASS |
| 430x932 | PASS |
| 768x1024 | PASS |
| 1024x768 | PASS |
| 1280x800 | PASS |
| 1440x900 | PASS |

各viewportで最低限確認:

- horizontal overflow
- header/navigation
- CTA visibility/usability
- text clipping
- image crop
- forms
- fixed/sticky overlap
- modal/drawer containment

## Required UI states

対象機能が存在する場合は確認する。

- default
- hover/focus
- loading
- disabled
- validation error
- server error
- success
- empty state

## Copy gate

- 架空情報なし
- `COPY_STANDARD.md` のspecificity test合格
- 主要コピーに意味重複なし
- 明らかに不自然な日本語なし
- CTAが何が起きるか理解できる
- 料金・条件が必要な箇所で曖昧化されていない

## Backend gate

対象機能が存在する場合:

- server-side validation
- authentication / authorization
- secrets not exposed
- predictable error handling
- duplicate submission/idempotency consideration
- persistence constraints
- rate limiting where appropriate
- no sensitive data in logs

## SEO / Accessibility gate

対象サイトでは最低限:

- title / description
- semantic heading order
- canonical where needed
- OGP
- sitemap / robots where applicable
- meaningful alt
- labels for form controls
- keyboard usability
- visible focus
- adequate touch targets
- no obvious contrast failure

## Review evidence

QA_REPORT.mdには以下を残す。

- tested commit/revision
- commands executed
- tested URLs/pages
- viewport matrix
- screenshots or artifact paths
- console/runtime errors
- reviewer findings
- fixes applied
- final PASS/FAIL

## Release rule

`Automated QA PASS` + `Visual Review PASS` + `Copy Review PASS` + `Technical Review PASS` + `SEO/A11y PASS`

すべて揃った後にのみ、人間へ公開承認を依頼する。
