# HANDOFF.md

最終更新: 2026-09-08（Claude Codeセッション、リポジトリ監査 + ChatGPT Work引き継ぎ情報の統合により作成）

## この文書の目的

Claude CodeとChatGPT Workのどちらが次のセッションを担当しても、GitHub上のこの文書と [docs/PROJECT_STATUS.md](PROJECT_STATUS.md) / [docs/NEXT_TASKS.md](NEXT_TASKS.md) だけを読めば、推測なしに正確に作業を再開できるようにする。

## 情報の出典について

- **[監査確認]**: 2026-09-08にClaude Codeがこのリポジトリのコード・テスト・git履歴を直接調査して確認した事実。
- **[本番確認]**: 同日、ChatGPT Workセッションから引き継がれた、本番環境での実地確認事実。Claude Codeは自ら再実行・再検証していないが、source of truthとして扱う。

---

## 1. システム全体像 [監査確認]

単一Node.jsプロセス上に**新旧2世代のAPIが共存**する構成。

- **v1（レガシー）**: [src/server.mjs](../src/server.mjs) — メモリ内Map + 任意のJSONファイル永続化（`DATA_FILE`）による自己完結型API。`/api/auth/*`, `/api/projects`, `/api/admin/*` を提供し、`public/` 配下の静的サイト（マーケティングサイト、旧`mypage.html`/`admin.html`）も配信する。LLM/決済/通知/ストレージは [src/providers.mjs](../src/providers.mjs) のアダプタ経由で、キー未設定時はモック/承認待ちにフォールバックする。
- **v2（本番方向）**: [src/platform-api.mjs](../src/platform-api.mjs) — `/api/v2/*` のみ担当。Supabase Auth + PostgreSQL（REST/RPC経由）をバックエンドとし、tenant/customer/project/request/workflowモデルで動作。
- **統合**: [src/platform-server.mjs](../src/platform-server.mjs) が両者を1つの`http.Server`にまとめ、v2でマッチしなければv1ハンドラへフォールスルーする。
- **Production Router**: 顧客の`request`作成後、[src/production-router.mjs](../src/production-router.mjs) が [src/production-pipelines.mjs](../src/production-pipelines.mjs) でリクエスト種別ごとの固定タスクグラフを組み立て、Supabase RPC `start_request_workflow` で`workflow_runs`/`tasks`を冪等に作成する。
- **Workflow Execution Engine + Worker**: 別プロセス（`npm run worker` → [src/worker.mjs](../src/worker.mjs)）が [src/workflow-execution-engine.mjs](../src/workflow-execution-engine.mjs) を5秒間隔で回し、RPC `claim_next_workflow_task`（`FOR UPDATE SKIP LOCKED`）でタスクを1件claimし、内部実行系（intake/direction/copy/research/reviewなど）はOpenAI Responses API（[src/openai-responses.mjs](../src/openai-responses.mjs)）、外部実行系（build/visual_review/technical_review/frontend_engineer/seo_accessibility）はGitHub Actions（[src/github-runtime.mjs](../src/github-runtime.mjs)）に振り分けて実行する。GitHub側は顧客リポジトリごとにworkflowを複製せず、Core repoの単一ワークフロー [.github/workflows/akinael-agent.yml](../.github/workflows/akinael-agent.yml) がGitHub Appから対象repository限定の短命tokenを発行してCodex CLIを実行する。
- **動的タスク展開**: `web_change`/`general`はまずtriageのみ実行し、[src/dynamic-expansion.mjs](../src/dynamic-expansion.mjs) がAIのtriage結果からタスクグラフを追加生成する（RPC `append_workflow_tasks`）。
- **Repository Bootstrap**: 新規Web案件の最初のbuildタスク実行時にのみ、[src/repository-bootstrap.mjs](../src/repository-bootstrap.mjs) が `akinael-ai-clients` Organization配下へprivateリポジトリを作成し、[src/customer-web-starter.mjs](../src/customer-web-starter.mjs)（Next.js 16 + Playwright QA同梱スターター）を投入する。
- **Release Gate**: 固定の必須タスクキー一覧に対し、完了状態・最新レビューPASS・実行証跡（artifact_id/run_id）の3条件を機械的に検証してから`deploy_ready`にする（[workflow-execution-engine.mjs:120-152](../src/workflow-execution-engine.mjs#L120-L152)）。
- **Human Gate**: 本番公開/DNS切替、新規課金・返金、破壊的操作、正式情報不足、法務リスクのみが人間承認対象。Research完了・Direction完了・QA/Review FAILは自動でループ処理される。

## 2. Portal実装状態 [監査確認]

[portal/](../portal/) — Vite + React 19 + TypeScriptのSPA（`portal/package.json`のbuildは`tsc -b && vite build`）。実体は [portal/src/Portal.tsx](../portal/src/Portal.tsx) 1ファイルで、v2 API（登録/ログイン/オンボーディング/案件作成/依頼・メッセージ送信/成果物プレビュー/顧客承認）を一通りカバーしている。

- [portal/app/](../portal/app/)（`PortalClient.tsx`, `layout.tsx`, `page.tsx`）と [portal/next.config.ts](../portal/next.config.ts) はNext.js版の実装が残存しているが、現行のビルドスクリプトは参照していないデッドコード（既知の技術的負債、後述）。
- ビルド成果物`public/portal/`はリポジトリに**コミットされておらず**、Renderのbuildcommandでのみ生成される。

## 3. Admin実装状態 [監査確認]

[admin/](../admin/) — Portalと同構成のVite + React 19 SPA。実体は [admin/src/Admin.tsx](../admin/src/Admin.tsx) 1ファイル。ログイン、パスワードリカバリ（Supabase Auth経由）、案件一覧、6タブ（概要/依頼・会話/Workflow/成果物・品質/承認/運用記録）のダッシュボードを実装。公開・課金操作はUIから直接実行できない（"Human Gate"表示のみ）設計。

- `public/admin/`配下のビルド成果物は**Portalと異なりリポジトリにコミット済み**（`7362090 fix(admin): bundle production static assets`）。render.yamlのbuildCommandは毎回上書きするため通常は使われないが、非対称性として記録（既知の技術的負債、後述）。

## 4. Workflow Execution Engine [監査確認]

もっとも作り込まれ、git history上も反復修正が多い部分（`fix(workflow): reconcile ...`系コミットが多数）。

- レビュー結果は`{"status":"PASS"|"FAIL","findings":[...],"summary":...}`の機械可読JSONを要求し、`npm run qa`（顧客リポジトリのQAコマンド）の結果と統合して最終FAIL/PASSを決定する。
- QA reconciliationロジック（[workflow-execution-engine.mjs:76-118](../src/workflow-execution-engine.mjs#L76-L118)）は、read-only環境起因の指摘・未提供の顧客情報起因の指摘・QA結果と矛盾する古い指摘を製品欠陥から分離する。[test/execution-engine.test.mjs](../test/execution-engine.test.mjs) に17ケースの単体テストあり。
- 修正ループは最大2サイクル、通常のタスク再試行はDBの`max_attempts`（既定3）まで。OpenAI/GitHub Actions側のbilling/quota枯渇は`terminal failure`として即座に再試行を止める。
- 画像生成タスクはPNGマジックバイト検証・SHA-256記録まで行い、機械的に検証可能な形でVisual Reviewを完結させる。

## 5. Supabase構成 [監査確認]

[supabase/migrations/](../supabase/migrations/) に7ファイル。プロジェクトref `rxxmbnlqomtfjekdrblo`。

- テーブル: `tenants`, `customers`, `user_profiles`, `customer_members`, `projects`, `requests`, `messages`, `workflow_runs`, `tasks`, `artifacts`, `quality_checks`, `approvals`, `payments`, `notifications`, `repositories`, `deployments`, `audit_logs`, `executor_jobs`
- 主要ロジックはPL/pgSQL関数として実装され、すべて`security invoker`＋`service_role`のみ実行可能（`start_request_workflow`, `claim_next_workflow_task`, `finish_workflow_task`, `append_workflow_tasks`, `upsert_executor_job`, `provision_customer_account`, `create_customer_request`）。RLSでテナント・顧客membership分離。
- 新方式のkey命名（`SUPABASE_SECRET_KEY`/`SUPABASE_PUBLISHABLE_KEY`）を優先し、legacy `SERVICE_ROLE_KEY`/`ANON_KEY`は互換のみ。

## 6. Render構成 [監査確認 + 本番確認]

[render.yaml](../render.yaml) に2サービス定義。

- **Web Service `akinael-ai`**: buildCommandが `npm ci` → portalビルド → adminビルド → 両方のdistを`public/`へコピーという一体型。永続ディスク（`/var/data`、1GB）は移行期間のJSON/ローカルファイル用。
- **Worker `akinael-ai-worker`**: `npm run worker`。`SUPABASE_SECRET_KEY`と`OPENAI_API_KEY`はWeb Serviceの環境変数を`fromService`参照。**[本番確認] 実際に稼働済みで、Production Workflowの本番E2Eを複数回完走している。**「未有効」という前提での再構築は禁止。
- [Dockerfile](../Dockerfile) が別途存在するが、portal/adminのビルドを一切含まない旧い定義（既知の技術的負債、後述）。

## 7. GitHub Actions構成 [監査確認]

- [.github/workflows/core-quality.yml](../.github/workflows/core-quality.yml): main/`feat/**`へのpush・PRで`npm test`のみ実行。portal/adminのビルド・lint・typecheckはCIに含まれていない。
- [.github/workflows/akinael-agent.yml](../.github/workflows/akinael-agent.yml): 中央実行ワークフロー。GitHub App scoped token発行（`persist-credentials: false`）→顧客repositoryをcheckout→`akinael/run-*`ブランチ→（visual_reviewの場合）Playwrightで360/768/1280px screenshot取得→`openai/codex-action`実行→保護パス復元→`npm run qa`→機械可読result file書き込み→保護パス変更があればコミット失敗させるガード付きでpush。
  - codex-actionはコミットSHA固定の`v1.11`相当にpin（既知の不具合への一時対応とコメントに明記）。
- [.github/workflows/runtime-smoke.yml](../.github/workflows/runtime-smoke.yml): 実credentialを使わずランタイム到達性を診断する（[scripts/runtime-smoke.mjs](../scripts/runtime-smoke.mjs)）。

## 8. テスト構成 [監査確認]

`node --test`（Node標準テストランナー）。[test/](../test/) に13ファイル・**87件**のテスト。2026-09-08に`npm ci`後`npm test`を実行し**全87件PASS**を確認済み。

- カバレッジは広く、特にworkflow execution engineのQA reconciliation、production pipelines/router、platform-store（Supabaseスコープ境界）、GitHub runtime（App installation token、org/personal owner分岐）、repository bootstrap、legacy server.mjsのAPI境界まで手厚い。
- portal/adminのフロントエンドには単体テストが存在しない。

---

## 9. 本番確認済み情報（ChatGPT Work引き継ぎ）[本番確認]

PHASE状況・本番証跡の詳細は [docs/PROJECT_STATUS.md](PROJECT_STATUS.md) を参照。要点のみ:

- Render Worker・OpenAI Responses API・GitHub App・GitHub Actions・Supabaseの実接続はすべて確認済み。
- PHASE 1〜4はCOMPLETE。PHASE 4は本番E2E（Workflow ID `baa79515-498b-4b38-b6a6-3d812fedf262`、Final Approval `35ec6138-1e0d-4b30-829d-a7baa4d9a70e`）まで完走済み。
- PHASE 5（Admin）はIN PROGRESS。残作業は本番ブラウザE2E。
- PHASE 4のE2Eデータは意図的に未削除。Project `52beffb0-0c87-4949-af45-a36a8e155462` はPHASE 5検証に使用中のため削除禁止。

## 10. 既知の技術的負債（削除・整理・再構築禁止）

以下は監査で見つかったが、**現在のPHASE完了を妨げる具体的な不具合が確認されるまでは触らない**。ユーザー指示により、別途の技術的負債として記録するに留める。

| # | 内容 | 詳細 | 現時点の扱い |
|---|---|---|---|
| 1 | 未マージリモートbranch 40件 | `feat/*`, `fix/*`, `codex/*` など。ChatGPT Work/Codexセッションの作業過程の残骸と見られるが、個別精査は未実施 | **削除禁止**。精査せず削除するのは危険 |
| 2 | `portal/app/` のNext.js残骸 | `PortalClient.tsx`, `layout.tsx`, `page.tsx`, `next.config.ts`。現行ビルド（Vite）からは未参照 | 放置。誤って編集しないよう注意 |
| 3 | `Dockerfile`の陳腐化 | portal/adminのビルドを含まず、render.yamlの実ビルド手順と乖離。実際に使われる経路があるか不明 | 放置。使用有無を確認してから対応判断 |
| 4 | v1 legacy API と v2 API の共存 | `src/server.mjs`（メモリ内Map）と`src/platform-api.mjs`（Supabase）が同一プロセスで並存。移行方針は[docs/platform-architecture.md](platform-architecture.md)に8段階で記載されているが、承認・決済・通知・監査ログ周りはv1書き込みエンドポイントがまだ残る | 移行方針に従い段階的に進める前提。今回は着手しない |
| 5 | `public/admin/`（commit済み）と`public/portal/`（未commit）の非対称性 | 意図的なフォールバックか消し忘れか不明 | 放置。作者への確認待ち |

## 11. 引き継ぎ時点で不足していた情報の現状

2026-09-08時点のリポジトリ監査だけでは分からなかった項目と、今回のChatGPT Work引き継ぎでの解消状況。

| 項目 | 状況 |
|---|---|
| Render上の実際のサービス状態（Web/Workerが実deploy済みか） | **解消** — [本番確認] Worker稼働中、複数回のE2E完走を確認 |
| GitHub Appのインストール状態 | **解消** — [本番確認] 両installation先で実接続確認済み |
| 本番ドメインのDNS・実際に案件が動いているか | **概ね解消** — production URLが実際に応答し、PHASE 4のE2Eが本番完走している。ただしDNS設定の詳細記録そのものは未確認 |
| 40件の未マージbranchそれぞれの意図 | **未解消** — 削除禁止の指示のみで、個別精査は未実施 |
| secret/APIキーの管理場所（1Passwordなど） | **未解消** |
| 既存の課金・顧客契約の実データ有無 | **未解消** — PHASE 4のE2Eデータがテスト目的か実顧客データを含むかは明言なし |

## 12. Human Gate（正本）

- 新しい有料サービスの開始
- production DNS変更・新規公開
- 実顧客への通知送信
- payment（決済）操作
- production dataの削除
- secretの発行・失効
- 不可逆なproduction変更
- 正式な事業情報が不足し推測できない場合

それ以外（Research、Direction、Build、QA fail、Review fail等の内部工程）は原則自律進行する。[AGENTS.md](../AGENTS.md) の非交渉事項とも整合する。

## 13. Completion Rule

unit test / build / CI成功だけではPHASE COMPLETEにしない。**本番環境での実動作が最終的なsource of truth**である。

## 14. セッション運用ルール

各セッション終了前に必ず以下を更新する（[CLAUDE.md](../CLAUDE.md) 参照）。

1. `docs/PROJECT_STATUS.md` — PHASE表・本番確認事実・E2E証跡を更新
2. `docs/HANDOFF.md`（本ファイル）— アーキテクチャ理解や技術的負債リストに変化があれば更新
3. `docs/NEXT_TASKS.md` — 完了項目を消し、新規判明タスクを追加

更新せずにセッションを終えることは禁止。
