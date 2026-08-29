# REVIEW_PIPELINE.md

## Goal

Builder自身の自己評価だけで完成判定しない。
独立した役割・コンテキストで検査し、FAILを具体的な修正指示として戻す。

## Roles

### Builder
対応: `frontend_engineer`

責務:
- 承認済み仕様を実装
- 自動テストを実行
- FAILを自己修正

Builderは最終品質判定者ではない。

### Visual Reviewer
主担当: `quality_assurance` のvisual pass

入力:
- PROJECT_SPEC
- DESIGN_SYSTEM
- 実ブラウザの各viewport screenshot

出力:
- PASS/FAIL
- viewport、場所、問題、期待状態

### Copy Reviewer
主担当: `content_editor` のreview pass。初稿作成コンテキストとは分離する。

入力:
- PROJECT_SPEC
- COPY_GUIDE
- 実装画面上の最終コピー

出力:
- PASS/FAIL
- 不自然な日本語、generic表現、事実誤認、重複、CTA不明瞭等

### Technical Reviewer
主担当: `quality_assurance`

入力:
- code diff
- tests
- runtime/build result
- API/DB仕様

出力:
- PASS/FAIL
- security、validation、error handling、architecture、regression

### SEO/A11y Reviewer
対応: `seo_accessibility`

最終DOM/実画面を対象に検査する。設計案のみでPASSにしない。

## Correction routing

| Finding | Return to |
|---|---|
| Copy | content_editor -> frontend_engineer |
| Visual/layout | visual_designer -> frontend_engineer |
| Responsive implementation | frontend_engineer |
| API/backend | frontend_engineer / backend implementation role |
| SEO/A11y | seo_accessibility -> frontend_engineer |
| Requirement ambiguity | project_director |
| Missing business fact | customer_intake / human |

## Loop

```text
Builder
 -> Automated QA
 -> Reviewers
 -> findings
 -> route by finding type
 -> correction
 -> affected tests
 -> full release QA
```

## Anti-loop rules

同じFAILが2回以上再発した場合、単なる再修正ではなく原因を分類する。

- specification gap
- missing canonical example
- missing automated test
- architecture problem
- reviewer ambiguity

原因に応じて、案件だけでなく共通STANDARD/テスト/テンプレートを改善する。

## Completion

Reviewerが「良さそう」と言うことではなく、QA_STANDARDのRelease ruleを満たすことを完了条件とする。
