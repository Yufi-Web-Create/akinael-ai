# AKINAEL_SITE_PLAN.md

## Positioning

アキナエルAIの公開Webサイトを、このAI Web Production Systemの最初のReference Projectとして扱う。

目的は単なるサイト刷新ではない。

1. 制作システム自身を実案件で検証する
2. 顧客サイトに流用できるCanonical Exampleを作る
3. 発生した修正を共通ルール・テストへ還元する

## Repository separation

推奨構成:

- `akinael-ai`: 現在のバックエンド、顧客案件、AIワークフロー、承認、決済等のControl Plane
- `akinael-ai-web`: アキナエルAIの公開マーケティングサイト
- `ai-web-production-template`: 将来、顧客サイト作成時に複製するWeb実装テンプレート

公開サイトとバックエンドを同一packageへ無理に統合しない。

## How Akinael site is built

### Phase 1: Intake from existing facts

既存の以下を材料に `PROJECT_SPEC.md` を生成する。

- `docs/business-concept-summary.md`
- `docs/website-content-requirements.md`
- 現行サイト
- 確定料金・承認ルール
- 確定ブランド/コピー方針

未確定情報はUNKNOWNとして残す。

### Phase 2: Design and copy source of truth

`DESIGN_SYSTEM.md` と `COPY_GUIDE.md` を確定する。

現行サイトの良い部分はReferenceとして残すが、実装の不具合や不自然なコピーは正解例にしない。

### Phase 3: Build

公開サイト専用リポジトリで実装する。

実装技術はAIによる自動QAとの相性を優先する。Webflowを使用する場合でも、仕様・レビュー結果・QA基準はGitHubをSource of Truthとして保持し、公開/preview URLをブラウザQA対象にする。

コード実装を採用する場合は、Playwright等による自動E2E/viewport検査をCIに組み込みやすいため、AI丸投げの再現性は高い。

### Phase 4: Review

実ブラウザで全ページを確認し、最低viewport matrixを撮影・検査する。

Copy Reviewerは設計資料上の原稿ではなく、最終画面に表示された文章を読む。

### Phase 5: Learn

人間から修正が入った場合、修正を案件だけに閉じない。

原因を次のいずれかへ分類する。

- project-specific preference
- COPY_STANDARD不足
- DESIGN_STANDARD不足
- QA test不足
- canonical example不足
- implementation defect

共通原因ならProduction Systemへ反映する。

## Migration safety

現行公開サイトを先に壊さない。

新サイトはpreview/stagingで完成させ、Release Gate PASSと人間承認の後に切り替える。

## Reference project completion

アキナエルAI公開サイトが完成しただけではReference Project完了ではない。

- QAで拾えなかった人間修正が分類済み
- 共通化すべき学びがSTANDARDへ反映済み
- 次の案件が同じ仕組みで開始できる

までを完了条件とする。
