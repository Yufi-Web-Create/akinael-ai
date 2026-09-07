# PROJECT_STATUS.md

最終更新: 2026-09-08（Claude Codeセッション、リポジトリ監査 + ChatGPT Work引き継ぎ情報の統合により作成）

## この文書の役割

「今、プロジェクトはどの状態か」を一箇所で確認するための現状スナップショット。アーキテクチャの詳細や技術的負債は [docs/HANDOFF.md](HANDOFF.md)、次にやる作業は [docs/NEXT_TASKS.md](NEXT_TASKS.md) を参照。

## 検証状況の凡例

- **[監査確認]**: Claude Codeがこのリポジトリのコード・テスト・git履歴を直接調査して確認した事実。
- **[本番確認]**: ChatGPT Workセッションが本番環境で実地確認し、2026-09-08に引き継いだ事実。Claude Codeはこれを自ら再実行・再検証していないが、source of truthとして扱う。

## プロジェクト基本情報 [本番確認]

- Core repository: `Yufi-Web-Create/akinael-ai`
- Customer repository organization: `akinael-ai-clients`
- Production: https://akinael-ai.com/
- Customer Portal: https://akinael-ai.com/portal/
- Admin: https://akinael-ai.com/admin/
- Supabase project ref: `rxxmbnlqomtfjekdrblo`
- GitHub App: `akinael-ai-runtime-yufi`（App ID `4762113`）
  - `Yufi-Web-Create/akinael-ai` へインストール済み
  - `akinael-ai-clients` Organization へインストール済み

## 本番ランタイム接続状況 [本番確認]

- **Render Worker: 稼働中**（未有効ではない）。Production Workflowの本番E2Eを複数回完走済み。
- OpenAI Responses API: 実接続確認済み
- GitHub App: 実接続確認済み
- GitHub Actions（中央実行ワークフロー）: 実接続確認済み
- Supabase: 実接続確認済み

> ⚠️ 今後のセッションは「Workerが未有効」「GitHub Appがまだセットアップされていない」という前提で再構築しないこと。これらは実際に本番稼働している。

## PHASE状況 [本番確認]

| PHASE | 内容 | 状況 |
|---|---|---|
| 1 | Production E2E | COMPLETE |
| 2 | Production Runtime監査・安定化 | COMPLETE |
| 3 | Image / Asset Production | COMPLETE |
| 4 | Customer Portal | COMPLETE |
| 5 | Admin | **IN PROGRESS** |
| 6 | Notification / Approval / Deployment Gate | NOT STARTED |
| 7 | Akinael Reference Production | NOT STARTED |
| 8 | Full Production QA | NOT STARTED |
| 9 | Production Release | NOT STARTED |

## PHASE 4 本番証跡 [本番確認]

- Workflow ID: `baa79515-498b-4b38-b6a6-3d812fedf262`
- Final state: `completed / completed`
- Build Run: `33637959513`
- SEO/A11y Review: `33644035238` PASS
- Visual Review: `33647937315` PASS
- Copy Review: `33661862728` PASS
- Technical Review: `33725443457` PASS
- Release Gate artifact: `d1029659-fcc4-47bb-9701-d927dfb0bab6`
- Final Approval: `35ec6138-1e0d-4b30-829d-a7baa4d9a70e`（`delivery / approved`）
- Customer Portal: 実Supabase Auth login PASS
- Real preview: Cloud Browser表示 PASS
- JavaScript application console errors: Portal 0 / Preview 0

PHASE 4は本番環境E2Eまで完了している。

## PHASE 5 現状

関連コミット [監査確認]:
- `516c3a2` feat(admin): add Supabase-backed operations console
- `7362090` fix(admin): bundle production static assets
- `7d78971` feat(admin): add secure password recovery flow
- `a871fc9` fix(auth): route recovery sessions through allowed URL
- `e2c2f8c` fix(auth): comply with recovery redirect CSP

確認済み事実 [本番確認、テスト結果のみ監査確認]:
- Production `/admin/`: HTTP 200 確認済み
- Core tests: 87 / 87 PASS（Claude Codeが2026-09-08に `npm ci` 後 `npm test` を実行し再現確認済み [監査確認]）
- Admin lint/build: PASS
- 未認証Admin API: 401 確認済み
- Customer role: 403 確認済み
- Admin password recovery flow: 実装済み

**PHASE 5はまだCOMPLETEではない。** 主な残作業は本番ブラウザE2E（実Supabase Auth管理者ログイン、admin profile生成確認、PHASE 4 E2Eデータの表示確認、Admin主要操作、reload後の状態、desktop/mobile viewport、JavaScript console error 0件）。詳細チェックリストは [docs/NEXT_TASKS.md](NEXT_TASKS.md) を参照。全項目PASSするまでCOMPLETEにしない。

## 既存E2Eデータ（削除禁止）

PHASE 4で作成した本番E2Eデータは、PHASE 5のAdmin検証でも使用するため意図的に未削除。

- 特に **Project `52beffb0-0c87-4949-af45-a36a8e155462`** はPHASE 5検証に利用できる。

## リポジトリ監査サマリー [監査確認]

2026-09-08時点:
- git: `main` ブランチ、`origin/main` と同期、作業ツリークリーン、最新コミット `e2c2f8c`
- v1（legacy in-memory API, `src/server.mjs`）と v2（Supabase-backed API, `src/platform-api.mjs`）が同一プロセスで共存
- Workflow Execution Engineは内部実行（OpenAI Responses API）と外部実行（GitHub Actions経由Codex）を振り分け、QA reconciliationロジックまで作り込み済み（[test/execution-engine.test.mjs](../test/execution-engine.test.mjs) に17ケース）
- Portal/AdminはどちらもVite + React 19 SPA、実体は各1ファイルのReactコンポーネント
- 未マージのリモートbranchが40件存在（削除禁止、技術的負債として記録のみ）

詳細は [docs/HANDOFF.md](HANDOFF.md) を参照。

## Human Gate（正本）

- 新しい有料サービスの開始
- production DNS変更・新規公開
- 実顧客への通知送信
- payment（決済）操作
- production dataの削除
- secretの発行・失効
- 不可逆なproduction変更
- 正式な事業情報が不足し推測できない場合

それ以外は原則自律進行する。詳細は [CLAUDE.md](../CLAUDE.md) および [AGENTS.md](../AGENTS.md) を参照。

## Completion Rule

unit test / build / CI成功だけではPHASE COMPLETEにしない。本番環境での実動作が最終的なsource of truthである。
