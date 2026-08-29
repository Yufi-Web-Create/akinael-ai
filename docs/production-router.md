# Production Router

## 目的

顧客Requestを保存したあと人間の振り分け待ちにせず、Request種別に応じた制作workflowを即時作成する。
フェーズはAI内部の工程であり、人間確認ポイントではない。Research、Direction、Build、QA、Review、修正は可能な限り自動で進み、Web/Automation系は原則DEPLOY READYまで、人間確認なしで進める。

## Request -> Pipeline

| Request type | Pipeline | 方針 |
|---|---|---|
| `web_new` | `web_new_full` | Research → Direction → Build → independent Review → Release Gate |
| `web_change` | `web_change_adaptive` | 変更影響を先に判定し、必要工程だけ動的追加 |
| `copy` | `copy_research` | 顧客言語/競合/媒体Research後に制作・独立Review |
| `social` | `social_content` | ブランド文脈Research後に制作・Review |
| `image` | `image_creative` | Visual Reference Research → Direction →制作→Review |
| `research` | `research` | 目的整理→調査→根拠Review |
| `automation` | `automation` | 業務整理→仕様→API調査→実装→Technical Review→Release Gate |
| `seo` | `seo` | 検索意図/競合/技術調査→改善→Review |
| `general` / `other` | `consultation_triage` | 相談を実装可能な種別へ分類して動的追加 |

## Web new rule

新規Web制作ではDesign/Copyの本制作前にResearchを必須とする。

```text
Understand
→ PROJECT_SPEC
→ Market / UX Research
→ Design Reference Research
→ Copy / Language Research
→ Direction Synthesis
→ UX Architecture
→ Copy Direction
→ Design Direction
→ Build
→ SEO/A11y Review
→ Visual Review
→ Copy Review
→ Technical Review
→ Release Gate
→ DEPLOY READY
```

Design Reference ResearchとCopy Researchは制作タスクとモードを分離する。
参考サイトの見た目や文言をコピーせず、判断理由・原則を抽出して複数Referenceから統合する。

## Adaptive workflows

`web_change` と `general/other` は最初から重い全工程を作らない。
初期workflowはTriageまで作成し、Triage結果を後続Orchestratorが読み、必要なResearch / Direction / Build / Reviewタスクを追加する。

これにより「営業時間を1時間変更」のような軽微修正にフルResearchを要求せず、「ブランド全体を高級にしたい」のような変更ではResearchを省略しない。

## Idempotency

1 Requestにつき初回workflowは1件。
`start_request_workflow` は既存workflowがあれば再作成せず既存IDを返す。
Customer Portalからの再送や通信再試行でworkflowを二重作成しない。

## Failure behavior

Request作成とProduction Routerは分離する。
Request自体が保存された後にRouter接続が一時失敗した場合、顧客へ再入力を要求しない。
Requestは `new` のまま保持され、後続workerのretry対象とする。

## Human Gate

途中フェーズでは停止しない。
停止可能なのは原則以下のみ。

- 本番公開 / DNS切替
- 新規課金 / 返金 / プラン変更
- 外部への正式送信や配信
- 破壊的データ操作
- 法務・権利・個人情報の重大リスク
- 正式な事業情報が不足し、推測すると虚偽になる場合

Research完了、Direction完了、QA FAIL、Review FAILはHuman Gateではない。FAILは修正タスクへ戻し、再検証する。
