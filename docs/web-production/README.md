# AI Web Production System

## Purpose

顧客サイト制作を「良いプロンプト」に依存させず、仕様・役割・テスト・レビュー・差し戻しで品質を安定させるための共通制作基盤。

## Core principle

AIに「プロっぽく」「レスポンシブをちゃんと」と依頼しない。

代わりに以下を固定する。

1. Source of Truth
2. Acceptance Criteria
3. Canonical Examples
4. Automated QA
5. Independent Review
6. FAIL -> Builderへの差し戻し

## Pipeline

```text
customer_intake
  -> project_director
  -> research_strategist
  -> ux_architect
  -> content_editor
  -> visual_designer
  -> frontend_engineer
  -> automated QA
  -> seo_accessibility
  -> quality_assurance
  -> FAILならfrontend_engineer/content_editor/visual_designerへ差し戻し
  -> 全項目PASS
  -> 人間による公開承認
```

## Per-project artifacts

各Web案件は最低限、以下の成果物を持つ。

- `PROJECT_SPEC.md`: 目的、顧客、要件、制約、ページ、機能、Acceptance Criteria
- `DESIGN_SYSTEM.md`: レイアウト、タイポグラフィ、余白、色、breakpoint、コンポーネント基準
- `COPY_GUIDE.md`: ブランドボイス、NG表現、具体例、確定原稿
- `TECH_SPEC.md`: 技術構成、データ、API、外部連携、セキュリティ
- `QA_REPORT.md`: 自動検査とAIレビューの結果

テンプレートはこのディレクトリ内の各STANDARD/TEMPLATEを使う。

## Required autonomous loop

```text
spec
 -> implement
 -> automated checks
 -> browser screenshots
 -> visual review
 -> copy review
 -> technical review
 -> fix
 -> rerun
```

FAILが残っている状態で顧客確認へ進めない。

## Human approval

人間が判断するのは次に限定する。

- 事業上の選択
- 情報不足で推測が必要になる場合
- 料金や契約
- 公開、課金、削除、外部送信等の不可逆操作
- 法務、権利、重大リスク

余白、文字サイズ、breakpoint、通常の実装方法などの制作判断はAI側で完結させる。
