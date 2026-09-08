# HANDOFF.md

最終更新: 2026-09-08 UTC checkpoint（PHASE 6 checkpoint）

## 目的

Claude Code / ChatGPT Workのどちらでも、チャット履歴に依存せず同じ状態から再開するための詳細引継ぎ。要約は `PROJECT_STATUS.md`、実行順は `NEXT_TASKS.md`。

## 1. Architecture / runtime

- Web: Render Web Service `akinael-ai`。`src/platform-server.mjs` がv2 Supabase-backed APIとv1 legacy APIを同一Nodeプロセスで配信し、`public/` の公開サイト、Portal、Admin、previewを配信。
- Worker: Render Background Worker `akinael-ai-worker`、`npm run worker`、5秒poll。`claim_next_workflow_task`でclaimし、内部タスクをOpenAI Responses API、外部Build/ReviewをGitHub Actionsへdispatch。
- DB/Auth: Supabase project `rxxmbnlqomtfjekdrblo`。Auth userと`user_profiles`/`customer_members`を分離。テナントは `8be8ebe5-f07e-4669-96cd-1806ff4d01aa`。
- GitHub runtime: Core `.github/workflows/akinael-agent.yml`。GitHub Appのrepository限定短命tokenを使い、`akinael/run-*` branch、Codex、QA、`.akinael/results/`を実行。
- Customer repo Organization: `akinael-ai-clients`。
- Frontends: Portal/AdminはいずれもReact 19 + TypeScript + Vite SPA。
- Release Gate: 必須タスク完了、最新Review PASS、artifact/run evidenceの3条件を機械判定。

## 2. 実装済み機能

- Production Router、固定/動的pipeline、冪等workflow開始、task claim/retry/terminal failure。
- GitHub App scoped token、customer repo bootstrap、中央Actions実行、result file取込。
- Research/Direction/Build/SEO-A11y/Visual/Copy/Technical/Release Gate。
- Image generation、PNG検証、Supabase Storage、customer repo反映、Visual Review evidence。
- Portal: Supabase Auth、onboarding、project/request/messages、progress、artifact/preview、customer approval。
- Admin: Auth/role、overview、project details、6タブ、password recovery。
- Human Gate: publish/DNS、payment/refund、delete、real customer notification等を自動実行しない。

## 3. 本番source of truth

- PHASE 1〜5 COMPLETE。
- `origin/main` HEAD:
  `e2c2f8cb60208f47586f7098fb368854c0b6010d`
  git上で確認する現在のmain。PR #42 merge後はこの値が変わるため、その都度更新する。
- Render Web Service `akinael-ai` live deploy commit:
  `e2c2f8cb60208f47586f7098fb368854c0b6010d`
  2026-09-04にRender画面で確認したproduction snapshot。`origin/main` HEADとは独立した運用上の事実として扱う(値が一致しているのは現時点の偶然であり、以後の再デプロイ有無は別途確認する)。
- 2026-09-07のHTTP確認: `/`, `/portal/`, `/admin/`, PHASE 4 previewは200。
- Admin実ログインはCloud BrowserでPASS。`kohayakawakohaya@gmail.com` / user `4b9af2d3-f500-4f5e-bced-0decf88f8feb` / role `admin`。
- password/recovery token/OTPはどこにも保存していない。今後もsecure browser auth経由のみ。
- PHASE 4 completed workflow: `baa79515-498b-4b38-b6a6-3d812fedf262`。
- PHASE 4 preview URL: `https://akinael-ai.com/preview/52beffb0-0c87-4949-af45-a36a8e155462/8c84cd57-8850-4401-9f36-c6127316a68c`。

## 3.1 PHASE 5 Admin final production E2E — COMPLETE

- 実Supabase Auth管理者ログイン: PASS。Cloud Browserの安全な認証入力を使用し、秘密情報は保存・表示していない。
- Admin profile: user `4b9af2d3-f500-4f5e-bced-0decf88f8feb`、tenant `8be8ebe5-f07e-4669-96cd-1806ff4d01aa`、role `admin` をDBで確認。
- PHASE 4 project `52beffb0-0c87-4949-af45-a36a8e155462` をAdminで開き、概要／依頼・会話／Workflow／成果物・品質／承認／運用記録の6タブを実データで確認。
- DBの最終workflow `baa79515-498b-4b38-b6a6-3d812fedf262` は `completed / completed`・tasks `16/16` completed。Adminの`20/23`は初回失敗workflowを含む集計であり、表示との整合を確認。
- 成果物タブからpreview artifact `8c84cd57-8850-4401-9f36-c6127316a68c` の実リンクを開き、Cloud Browserで画面描画成功。
- 承認 `35ec6138-1e0d-4b30-829d-a7baa4d9a70e` は `delivery / approved` とDB・Admin表示で一致。
- reload後も認証維持・案件再表示を確認。
- viewport: desktop `1363×936`、tablet `768×1024`、mobile `390×844` で主要UI・6タブ・案件情報・Workflow・承認に崩れ／操作不能なし。
- console: Adminとpreviewのapplication errorは0。Cloud Browser拡張由来 `chrome-extension://...` metadata error（Admin 21件）はアプリ外として分離。
- 主要な読取操作・タブ遷移・preview表示で403/500/不整合なし。
- 次PHASE: **PHASE 6 / Notification / Approval / Deployment Gate**。

## 4. 直近のAdmin障害と修正

Admin loginはSupabase Authまで成功したが、`Promise.all(auth/me, admin/overview)` のoverview側が500。Supabase API logで、同時刻のcustomers/projects/workflows/tasks/approvalsは200、notificationsのみ403と判明。

本番へ次をmigrationとして適用済み。

```sql
grant select on table
  public.notifications,
  public.payments,
  public.deployments,
  public.audit_logs
to service_role;
```

- Supabase migration name: `grant_admin_read_service_role_access`
- version: `20260904004834`
- 4テーブルのSELECT grantを実DBで確認済み。
- 修正後、同じ管理者でAdmin実ログインとoverview表示に成功。
- **状態更新（2026-09-08 JST, Claude Code）**: `supabase/migrations/20260904004834_grant_admin_read_service_role_access.sql` を `docs/shared-handoff-foundation` branch（PR #42、Draft）へ追加し、本番へ実際に適用済みの4テーブルSELECT grantをsource controlへretroactiveに記録した。**productionへの再適用は行っていない。** `origin/main` への反映はPR #42のmerge待ち。以前のWork scratchにあった `20260904005000` という誤ったバージョン番号は使用せず、本番migration履歴のバージョン `20260904004834` と完全一致させた。
- 未確認事項として残す: Supabase migration history（`supabase_migrations.schema_migrations`）に `20260904004834` が正式なレコードとして記録されているかは未確認。必要に応じて今後Supabase側で確認する。

## 5. E2E data — 削除禁止

オーナー確認なしに削除しない。projectをcascade deleteすると下記証跡も失うため、root IDだけでなく関連行を保持する。

### PHASE 4 primary roots

- Tenant: `8be8ebe5-f07e-4669-96cd-1806ff4d01aa`
- Customer: `50105824-c191-43b3-9960-7e83c9f97643`
- Customer Auth user: `df9b7574-4164-4014-8e95-5faa47aa5ff5`
- Project: `52beffb0-0c87-4949-af45-a36a8e155462`
- Requests: `7f0ebdd3-da5b-4c51-986b-b0eca762c44d`, `8b94664a-8851-4de1-b447-58dc045cafe2`
- Workflows: `90cc0e26-fc76-4192-b4c9-37383e0005ad`（初回失敗証跡）, `baa79515-498b-4b38-b6a6-3d812fedf262`（最終PASS）
- Messages: `6cc47662-b06c-40a2-82c9-569e4bcd0fa9`, `12caff70-fa51-4a7e-869c-a6f741848274`, `a95554d7-dba6-4a55-91d2-f2af7b1d9096`, `8d987e39-7dd9-45a7-9ada-9d7d5157e3e6`
- Final approval: `35ec6138-1e0d-4b30-829d-a7baa4d9a70e`

### PHASE 4 critical tasks

- Build `7ef95dd3-8a2e-4d5e-b902-2c182f8cef75`
- SEO/A11y `853d4c7b-9764-4f8a-8a99-69a17763ad8a`
- Visual `e867995e-875b-46ac-abf2-01960ace01f8`
- Copy `07f60b15-21ef-475d-ab5c-22f0e1ee9e0f`
- Technical `8ca28beb-0502-4ba3-a0ca-fb69afbc5950`
- Release Gate `d8e1d6ec-864b-4b7e-8c64-7f0b591f18bc`

### PHASE 4 critical artifacts/jobs

- Preview artifacts: `8c84cd57-8850-4401-9f36-c6127316a68c`, `bc3183b5-5294-448e-96b6-38c1d7e3c194`
- Release Gate artifact: `d1029659-fcc4-47bb-9701-d927dfb0bab6`
- Executor jobs: `7d1bd6be-819f-4b8a-8bdd-f66ab4484c45`, `71b4ccc7-35c2-4a32-8a75-29e44449a721`, `f5119fc5-f51d-472c-ba75-864ea91177eb`, `9b2c90a9-5226-476e-b76a-2b8e8ac71e81`, `80e703ff-06ae-4281-a5c0-8e6063384075`

### PHASE 1/3 E2E roots（同じく保持）

- Project `be50c2c4-3bfa-4133-adbd-9d2d23dea10e`
- Web workflow `7469cea7-d664-451e-8c25-46a7204ae51b`
- Image workflow `4d91d88d-6935-478d-90fc-57da520d59b8`
- Release artifact `aa9a7098-62bf-43ff-ad42-2889dc9dab22`
- Image artifact `35261129-dbd3-44a6-9430-e39d9ee6629d`
- Visual artifact `2319bd68-d76b-47f0-91a1-6dd0fe0832fa`

### Admin records（削除禁止）

- Auth user `4b9af2d3-f500-4f5e-bced-0decf88f8feb`
- Admin profile tenant `8be8ebe5-f07e-4669-96cd-1806ff4d01aa`, role `admin`
- Audit `6dcf4244-f0f6-458f-9385-419856f26c1e`

## 6. Known technical debt

| 項目 | 状態 / 扱い |
|---|---|
| Production migration drift | `20260904004834`は本番へ適用済み。`docs/shared-handoff-foundation`（PR #42、Draft）へsource control記録済み、`origin/main`への反映はmerge待ち。Supabase migration history上の正式記録有無は未確認。 |
| Base schemaの一部がgit管理外 | `notifications`/`payments`/`deployments`/`audit_logs`等の`create table`定義がこのリポジトリの`supabase/migrations/`に存在しない。base schema全体は現在のmigration群だけでは再構築できない可能性がある。今回のmigration driftは、この構造的ギャップが表面化した一例と見られる。PHASE 5の進行は妨げないため、base schemaの再構築・追加migration作成は今回行わない。今後、本番のフルスキーマdumpとの突合を検討する。 |
| Remote branches | 2026-09-07時点45 remote refs（main含む）。意図未精査。**削除禁止**。 |
| `portal/app/` | Next.js版残骸。現行Vite build未参照。勝手に削除しない。 |
| `Dockerfile` | Renderの実build手順と乖離。利用経路確認前に変更しない。 |
| v1/v2 API共存 | `src/server.mjs` と `src/platform-api.mjs` が同居。段階移行課題。 |
| frontend test不足 | Portal/Adminはunit/component testなし。build/lintと本番E2E依存。 |
| CI範囲 | `core-quality.yml` はCore `npm test`中心。Portal/Admin build/lintを常時CI化していない。 |
| build artifacts非対称 | `public/admin/` commit済み、`public/portal/`はRender生成。意図の明文化なし。 |
| Project statusの混在 | PHASE 4 projectには初回failed workflowと最終completed workflowが共存し、project自体は`intake`のまま。Admin集計では20/23等に見える場合がある。最新workflow単位で判定する。DB statusを手動補正しない。 |
| Advisor | Leaked Password Protection disabled警告。プラン/運用影響を確認して別途判断。今回勝手に有効化しない。 |
| DB indexes | `executor_jobs.project_id` FKのcovering indexなし、unused index情報あり。性能問題の実測なしに削除・再構築しない。 |

## 7. Secrets / production data

- GitHubへ保存してよいのはproject ref、resource ID、Run ID、公開URLまで。
- 保存禁止: password、OTP、recovery URL/token、Supabase secret/service role key、publishable keyの実値、OpenAI key、GitHub App private key、Render env値、cookie/session/localStorage token。
- Secretの「存在確認」は値を表示せず、provider UIのconfigured/synced状態または疎通結果で行う。
- 本番DBのcontent/body/message本文は必要最小限のみ参照し、引継ぎ文書へ転載しない。
- 実顧客かE2Eか不明な行は実顧客として扱い、変更・削除・通知しない。

## 8. Human Gate

公開/DNS、課金/返金、実顧客通知、production data削除、Secret発行/失効、不可逆変更、正式情報不足/法務リスク。PHASE 5は完了。PHASE 6の公開・通知・課金などに進む場合はHuman Gateを再判定する。


## PHASE 6 checkpoint (2026-09-08 UTC checkpoint)

- CURRENT PHASE: PHASE 6 / Notification / Approval / Deployment Gate — IN PROGRESS
- Branch: `codex/phase6-notification-deployment-gate`; Draft PR #43.
- Latest remote commit: `5a32d626ba7e26e8f012d6c4f896ff00636d399e`.
- Completed: v2 API exposes a computed deployment gate; Portal shows notification/deploy-ready/Human Gate; customer approval persists notification and audit evidence; duplicate delivery approval is returned without another insert.
- PASS: local Core `npm test` 87/87; Portal/Admin production builds PASS.
- Current error: none in code/tests. Local Git HTTPS push lacks interactive credentials; equivalent commits were saved to the remote branch through GitHub connector. Generated local Vite artifacts are untracked and not part of the PR.
- Unfinished: strengthen DB-level idempotency, Admin notification/deployment gate display, CI/review, merge/deploy, production E2E including authorization/failure cases. Production is **not** updated.
- Exact next action: inspect PR #43 diff/CI, add DB-backed idempotency plus Admin display and tests, then review/deploy/E2E. Do not create real-customer notifications or production publishes.
- Human Gate: NO for continued implementation; YES for real-customer notification or production publish/DNS.

## PHASE 6 checkpoint (2026-09-08 UTC — notification/deployment hardening)

- CURRENT PHASE: **PHASE 6 / Notification / Approval / Deployment Gate — IN PROGRESS**
- Branch / PR: `codex/phase6-notification-deployment-gate` / Draft PR #43.
- Latest remote source commit: `28643261f1fa9de9feaa83f24197818c18f0214d`.
- Completed implementation: malformed literal `\\n` in the prior PR source/tests was fixed; v2 derives release/approval/deployment gate server-side; delivery approval uses a stable `idempotency_key`; notification/audit failures do not change a durable approval into a false failure; Portal and Admin display notification and gate state.
- Production migration: `supabase/migrations/20260908011350_add_notification_approval_idempotency.sql`. Supabase migration tooling assigned version `20260908011350`; the source file matches that recorded version. It is additive and is applied to production. Verification: 1 approval idempotency column, 4 notification columns, 2 unique indexes. Do not reapply `20260904004834`.
- PASS: `npm test` 88/88; Admin build PASS; Portal build PASS. Generated Vite artifacts are local-only/untracked and were not committed.
- Current errors: none after correction. Direct `git push` cannot authenticate in this environment; source was persisted through the GitHub connector to the same remote branch. Do not use secret/credential workarounds.
- Exact next action: inspect PR #43 diff and latest CI; perform independent review. If clean, make PR ready, merge after CI, verify Render deploy, then run non-destructive E2E TEST approval/gate checks.
- Production: DB migration is applied; application code is **not** deployed. No real-customer notification or production publish occurred.
- Human Gate: NO for review, additive schema, tests and E2E TEST; YES for real-customer notification, production publish/DNS, payment/refund, data deletion, or Secret actions.

## PHASE 6 deployment checkpoint (2026-09-08 UTC)

- `origin/main` merge commit: `45e449e94ee6275285438d5d2ad2a87c1bc419fa` (PR #43 merged).
- CI PASS: Core Quality `34176064714`.
- Production DB: migration `20260908011350 / add_notification_approval_idempotency` applied and verified (1 approval idempotency column, 4 notification delivery/idempotency columns, 2 unique indexes). No E2E data was deleted and no real-customer notification was sent.
- Current blocker: Render live did not yet serve the merged Admin asset. A fresh Cloud Browser `/admin/` returned `/admin/assets/index-B6nNySKH.js`, which predates the new Deployment Gate UI. Do not mark production E2E as PASS and do not create approval test data until the new Render deploy is visibly live.
- Exact next action: check Render service deploy event for commit `45e449e94ee6275285438d5d2ad2a87c1bc419fa`; once live, load fresh `/admin/`, confirm Deployment Gate UI, then use secure Supabase Auth and an explicitly E2E TEST customer/project to verify notification/idempotency/authorization/Portal/Admin/console. Do not publish production.
- Human Gate: NO for Render application deployment troubleshooting. YES for real-customer notification, customer production publish/DNS, payment/refund, deletion, or Secret actions.

## PHASE 6 E2E blocker (2026-09-08 UTC)

- Render blocker: resolved by owner; latest main `a6d3e82` is Live and fresh Admin new UI confirmed.
- Remaining E2E requires an E2E-only customer identity to submit the Portal approval event.
- Cloud Browser secure registration was denied by its safety policy before the user prompt could be shown. No credential, user, notification, approval, or production data was created or changed.
- Do not circumvent browser auth. Exact next action: use an already-authorized E2E customer login through the secure browser-auth surface, or ask the owner to provide an E2E customer account via the approved authentication workflow; then resume Portal approval/idempotency and Admin/DB E2E.
