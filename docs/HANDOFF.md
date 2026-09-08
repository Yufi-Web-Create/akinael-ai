# HANDOFF.md

最終更新: 2026-09-08 JST（Claude Code、Admin/Portal stale-session recovery修正 — PR #53/#54 merge・production反映確認済み）

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
  `c2c328f`
  git上で確認する現在のmain（2026-09-08、PR #53/#54 merge後）。今後mainが進んだらその都度更新する。
- Render Web Service `akinael-ai` live deploy commit:
  `c2c328f`世代
  2026-09-08に読み取り専用HTTP確認（bundle byte-diff）で確認済み。詳細は本ファイル末尾の最新checkpoint参照。`origin/main` HEADとは独立した運用上の事実として扱う。
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
| build artifacts非対称 / Renderがpublic/admin/を自動更新しない（未解明） | `public/admin/` commit済み、`public/portal/`はRender生成。当初は「意図の明文化なし」という記述だったが、2026-09-08にこれが実害を伴う問題だと判明: `render.yaml`のbuildCommandは`cp -R admin/dist public/admin`を含み毎deployでcommit済みファイルを上書きするはずだが、実際には`public/admin/`は`7362090`/`7d78971`（2026-09-04）以降、Admin.tsxへの複数回の変更（password recovery UI、CSP対応、Deployment Gate UI、今回のstale-session修正）を経てもbundle hashが更新されなかった。一方`public/portal/`は同一deployで正しく最新化されていた（PR #53 merge後、数分でbyte-diff一致を確認）。原因はRenderのdashboard側実際のbuildCommand設定またはbuild logでの確認が必要で、このsessionはRender管理画面アクセスがなく特定できていない。**暫定対応（PR #54）**: `public/admin/`のbuild出力を`admin/`のsource commitと手動で同期させ、production反映をbyte-diffで確認。**今後、admin側のcode変更を行うたびに、production反映をportal同様の自動更新に頼らず、byte-diff等で明示的に確認すること。**根本原因（Renderのbuild設定）の特定と恒久修正は未着手。 |
| Project statusの混在 | PHASE 4 projectには初回failed workflowと最終completed workflowが共存し、project自体は`intake`のまま。Admin集計では20/23等に見える場合がある。最新workflow単位で判定する。DB statusを手動補正しない。 |
| Advisor | Leaked Password Protection disabled警告。プラン/運用影響を確認して別途判断。今回勝手に有効化しない。 |
| DB indexes | `executor_jobs.project_id` FKのcovering indexなし、unused index情報あり。性能問題の実測なしに削除・再構築しない。 |
| Homepage registration CTAが`/mypage`のまま | `public/index.html`の無料相談登録CTA（`data-auth-open="register"`）は`public/assets/app.js`経由で旧`/mypage`ダイアログを開く。PHASE 4で完成した Customer Portal（`/portal/`）へは未接続。本番の新規顧客獲得導線に影響するため、修正はオーナー確認後に行う（`docs/web-production/AKINAEL_PROJECT_SPEC.md` 11節）。 |
| Portal/Adminのrecovery UI重複 | `portal/src/Portal.tsx`と`admin/src/Admin.tsx`のpassword recovery state/handler/JSXがほぼ同一のまま複製されている。両者は別々のVite package（別node_modules）のため、共有には内部package/workspace化が必要。今回は複製のまま実装（PR #44）。**この重複が直接原因で、Admin.tsxには次の行の未修正バグが残っている。** |
| ~~Admin.tsxのstale-session recovery不可バグ~~ — **修正済み（2026-09-08、PR #53）** | `admin/src/Admin.tsx`が`Portal.tsx`の`9233e79`と同種のバグを持っていた問題。`if(recoveryMode\|\|!token\|\|!me)`へゲートを修正。回帰test `admin/src/Admin.test.tsx`で修正前FAIL・修正後PASSを確認。production反映もPR #54でbyte-diff確認済み。 |
| ~~Portal/Adminのpassword更新後にセッションが残る~~ — **修正済み（2026-09-08、PR #53）** | `updatePassword`成功後に既存の`logout()`を呼び、token/localStorage/Reactステートをクリアするよう両ファイルを修正。回帰test（`portal/src/Portal.test.tsx`・`admin/src/Admin.test.tsx`）で修正前FAIL・修正後PASSを確認。 |

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

## PHASE 6 autonomous verification checkpoint (2026-09-08 UTC)

- Owner confirmed Render Web latest main `a6d3e828ad89148448ee02b4520c46b631dc1009` is Live and fresh Admin shows PHASE 6 UI.
- DB evidence (read-only): notifications `0`, approvals `1`, deployments `0`, audit logs `1`; approved delivery `1`; production deployments published `0`.
- PHASE 4 release gate task `d8e1d6ec-864b-4b7e-8c64-7f0b591f18bc` is `completed`, `review.status=PASS`, and references artifact `d1029659-fcc4-47bb-9701-d927dfb0bab6`; final approval remains approved. This is valid existing evidence for the approved + Release Gate PASS path and no production publish path.
- Unauthorized production endpoint and Admin overview both return HTTP `401` (read-only curl). No v2 deployments endpoint was found/exposed; direct customer production deployment is therefore not available through the v2 API.
- Remaining blocker is only Customer Portal authenticated E2E approval/notification creation: Cloud Browser cannot create a new user. Existing E2E customer `yuchi.info.contact@gmail.com` has no active Portal session; no supported safe recovery/passwordless entry point is exposed by the Portal UI.

## Final handoff authority — PHASE 6 (2026-09-08 UTC)

- **CURRENT PHASE:** **PHASE 6 / Notification / Approval / Deployment Gate — IN PROGRESS**. **PHASE 1–5 are COMPLETE; PHASE 6 is not COMPLETE.**
- Earlier Render old-asset notes are historical. Owner confirmed Render Web main `a6d3e828ad89148448ee02b4520c46b631dc1009` is Deploy succeeded / Live and fresh Admin displays PHASE 6 UI.
- PHASE 6 code is merged at `45e449e94ee6275285438d5d2ad2a87c1bc419fa`; production migration `20260908011350_add_notification_approval_idempotency.sql` is applied and verified. Core tests **88/88 PASS**; Portal/Admin builds PASS.
- **Sole remaining blocker:** authenticated Customer Portal production-browser E2E. Existing E2E customer `yuchi.info.contact@gmail.com` has no active Portal session, and Portal offers no supported safe password-recovery/passwordless route. Cloud Browser rejected new-customer creation under policy. No bypass/workaround was attempted; no credential, user, notification, approval, or production data was created.
- **Exact next action (Claude Code):** implement a formal Customer Portal password-recovery flow, authenticate the existing E2E customer securely through that route, then complete the notification/approval/deployment-gate E2E and Portal/Admin/DB consistency checks. Never persist password, OTP, recovery URL/token, or session data.
- **Human Gate:** real-customer notification, production publish, DNS change, payment/refund, production-data deletion, Secret issuance/reissue/revocation, and irreversible production changes. Do not delete E2E/production data without explicit owner approval.

## PHASE 6 autonomous session checkpoint (2026-09-08, Claude Code, 1-hour autonomous window)

- **UPDATE (2026-09-08, second Claude Code session): all three PRs below are now MERGED and confirmed LIVE on production.** `origin/main` is `b0e8a6e84fdf327ec561a30a5111e24dc474c0fc` (this also includes PR #47, this checkpoint's own doc corrections, and PR #48, the PHASE 7 implementation plan — both docs-only, no further app changes). The "merge permission boundary" and "exact next action: merge PRs" bullets further down are from the earlier session and are now historical — see the corrected status in `docs/PROJECT_STATUS.md`'s "PHASE 6 autonomous session checkpoint — UPDATED" entry for the current, accurate picture, including how production deploy was verified without Render dashboard access (plain read-only HTTPS requests to `akinael-ai.com`; `curl -I`/HEAD requests always 404 on this app regardless of route — use GET). PHASE 7 now also has an implementation plan (`docs/web-production/AKINAEL_IMPLEMENTATION_PLAN.md`), confirming the homepage CTA→Portal fix needs only a redirect-target change, plus a single-page-vs-multi-page recommendation (hybrid: keep homepage, add industry pages only). Still Research/Direction only — no Build.
- **PR #44 `fix/portal-password-recovery`** (merged as `a6bb4cc`, CI PASS): implements the Customer Portal password-recovery flow required to unblock the PHASE 6 E2E. Design: reuses `/api/v2/auth/password-recovery` and `/api/v2/auth/password` exactly as already shipped for Admin — no new auth endpoint, no bypass, no hardcoded credential. The one piece of shared infrastructure that needed to change is `public/assets/recovery-redirect.js`: the recovery email's `redirect_to` is deliberately kept fixed at the only Supabase-allow-listed URL (`${PUBLIC_URL}/mypage`, unchanged) for both apps, and the bounce script now calls `/api/v2/auth/me` with the recovery access token to read `profile.role` before choosing `/admin/?mode=recovery` vs `/portal/?mode=recovery` — this avoids touching Supabase Auth's redirect-URL allow-list, which this session cannot inspect or safely change. Independent review via the `code-review` skill found: (1) **real bug, fixed** — the recovery UI was nested inside `!token`, so a customer with a stale but still-valid `localStorage` session would never see it; reordered the top-level branch so `recoveryMode` takes priority. (2/3) the client-side role lookup fails open to `/portal/` (not `/admin/`) on any error — evaluated and kept as the safer default for the common case (misrouting is a UX inconvenience only, not a security issue, since Admin's password-set form grants no privilege by itself) rather than moving the decision server-side, which would require a Supabase redirect-URL config change this session can't verify. (4) code duplication between `Portal.tsx`'s and `Admin.tsx`'s recovery UI — recorded as tech debt, not actioned (see table below). (5) tests only assert on script source substrings, not real branching — accepted as consistent with this repo's existing testing depth for static assets (e.g. `app.js` is tested the same way).
- **PR #45 `fix/protect-portal-preview-from-indexing`** (merged as `75cda86`, CI PASS): `robots.txt` / `x-robots-tag` noindex protection, present for `/mypage` and `/admin`, was never extended to `/portal/` or `/preview/:projectId/:artifactId` when those shipped. Fixed; see commit message for full detail. Found while doing the PHASE 7 SEO/technical-baseline research below — unrelated to the auth fix. **Confirmed live**: `GET /portal/` on production now returns `x-robots-tag: noindex, nofollow`; `GET /robots.txt` includes the new `Disallow` lines.
- **PR #46 `docs/phase7-akinael-site-research`** (merged as `ee12c79`, CI PASS, docs-only): `docs/web-production/AKINAEL_PROJECT_SPEC.md`, a Research/Direction artifact for PHASE 7 following `AKINAEL_SITE_PLAN.md`'s own process. No Build performed. See that file's section 11 for the decisions that need owner input (repository separation, multi-page IA expansion, and — most concretely — that the homepage's registration CTA still opens the legacy `/mypage` dialog instead of the completed `/portal/`, so PHASE 4/5's finished apps aren't actually wired into the site's acquisition funnel yet).
- **Merge permission boundary (historical, resolved this session):** the *first* autonomous session's `gh pr merge` attempt on PR #44 was blocked by that session's permission classifier. This *second* session re-attempted the same command and all three merges (`#44`, `#45`, `#46`) succeeded without any workaround. The block appears to vary by session rather than being a fixed rule — don't assume it will always block, but don't assume it will always succeed either; just attempt it, and if blocked, record the block and move to independent work rather than routing around it.
- **Render deploy verification method (reusable, no dashboard credentials needed):** fetch known static/bundle content over plain HTTPS and check it matches the new source. Concretely used this session: `curl -s https://akinael-ai.com/assets/recovery-redirect.js` (compared byte-for-byte against the new file), `curl -s https://akinael-ai.com/robots.txt` (new `Disallow` lines present), `curl -s -o /dev/null -w '%{http_code}' https://akinael-ai.com/portal/` plus `curl -s -D - -o /dev/null https://akinael-ai.com/portal/` for the `x-robots-tag` header, and fetching the Portal's actual JS bundle (parse the `<script src=...>` out of the `/portal/` HTML, then `curl` that path and `grep` for a string only the new code contains, e.g. `PASSWORD RECOVERY`). All of this confirmed Render had already redeployed `ee12c79` by the time this session checked — **Render auto-deploys on push to `main`**, resolving a previously open question. Gotcha: this app's HTTP router only checks `method === 'GET'` per route, so `curl -I` (HEAD) 404s on every route including working ones — always use GET when probing it.

New technical debt found this session (added to the table below): the homepage's registration CTA points at the legacy `/mypage` dialog rather than the completed Customer Portal (`/portal/`); the recovery-UI logic is duplicated between `Portal.tsx` and `Admin.tsx` rather than shared.

## PHASE 6/7 critical fix + PHASE 7 Build session (2026-09-08, third Claude Code session)

Owner approved PHASE 7 Build (Astro migration + homepage + 4 industry pages) in a separate repo, `Yufi-Web-Create/akinael-ai-web`. While wiring that site's CTA to this Core API, independent review of the already-merged recovery work surfaced a **critical, already-shipped bug** — fixed immediately since it directly blocks PHASE 6.

- **PR #51 `fix/recovery-hash-race-with-app-js` — MERGED (`84d9050`), confirmed live.** PR #44's async `recovery-redirect.js` (needed to pick `/admin/` vs `/portal/` by role) lets `app.js` — `defer`red on the same `/mypage` page — finish first every time in practice, since finishing HTML parse is always faster than the `/api/v2/auth/me` round-trip. `app.js` unconditionally reads any `access_token` out of the hash, writes it into `localStorage['customer-token']` (the same key `Portal.tsx` uses for real sessions), and strips the hash. By the time `recovery-redirect.js`'s fetch resolves, the hash is gone, so the redirect it builds carries no token — **the password-recovery flow PR #44 shipped was actually broken for real browser users the whole time it's been live**, which this session's own PHASE 6 blocker report did not catch (only static/HTTP checks were done, not a real click-through). Fixed by (a) capturing `location.hash` once before the first `await` in `recovery-redirect.js`, and (b) making `app.js` skip its hash-consuming logic when `type=recovery`. New `test/recovery-redirect-race.test.mjs` executes both scripts under `node:vm` with the actual race simulated — verified it fails against the pre-fix code, passes against the fix. Confirmed live via `curl https://akinael-ai.com/assets/app.js` / `recovery-redirect.js` showing the new code.
- **PR #50 `feat/marketing-site-cors` — MERGED (`ce2e8d2`), confirmed live.** Found while building akinael-ai-web's register widget: this API sent no CORS headers at all, so a cross-origin browser call to `/api/v2/auth/register`/`login` would be blocked. Scoped `Access-Control-Allow-Origin: *` (+ OPTIONS preflight) to just those two routes; rest of `/api/v2/*` unchanged. Confirmed live via `curl -X OPTIONS https://akinael-ai.com/api/v2/auth/register`.
- **`origin/main` is now `ce2e8d27f1550e8c296ba4116f3c7ed0fafae962`** (after these two + the prior checkpoint merges).
- **PHASE 6 status revised:** the recovery flow is now genuinely fixed and live, not just deployed-but-broken as it was for part of this day. Work's Cloud Browser E2E should be attempted now, not before — attempting it prior to `84d9050` would have failed even with a valid link.
- **New technical debt found, not fixed (out of scope — this session was told not to change PHASE 6 state beyond the one critical fix required to make the shipped feature actually work):**
  - `admin/src/Admin.tsx` has the identical unreachable-recovery-UI bug that `Portal.tsx` had before `9233e79` fixed it there — Admin's recovery card is still nested inside the `!token||!me` gate, so an admin with a valid stale session cannot reach the "set new password" form via the emailed link. Never fixed because the two files are independent copies with no shared component.
  - `Portal.tsx`'s `updatePassword` never clears an existing `token`/`localStorage` session after a successful reset. If a stale-but-valid session exists at reset time, the success message says "log in again" but the UI falls through to the authenticated dashboard using the old session instead.
  - Both stem from the same root cause: `portal/src/Portal.tsx` and `admin/src/Admin.tsx` duplicate the entire recovery state machine with no shared hook/component (see table below).
- **PHASE 7 (separate repo):** `Yufi-Web-Create/akinael-ai-web` PR #4 builds the Astro homepage + 4 industry pages the owner approved. Not this repo's concern beyond the CORS/recovery fixes above, which that PR's CTA needed. See that repo's `docs/PHASE7_HANDOFF.md`.
- **Human Gate:** unaffected. No production data touched; no real-customer notification, DNS, or payment action.

## PHASE 6 stale-session recovery fix + admin static-asset sync (2026-09-08, fourth Claude Code session)

Closed both technical-debt items from the checkpoint above. **This does not complete PHASE 6** — it removes the last known code-level gap before Work's Cloud Browser E2E, which is still the sole remaining step (see `docs/NEXT_TASKS.md`).

### The two fixes

- **Admin stale-session recovery-UI unreachable** (`admin/src/Admin.tsx`): the recovery card was nested inside `if(!token||!me)`. A background `load()` succeeding for a stale-but-valid token silently won over `recoveryMode`, so an admin opening a recovery-email link with an old session in `localStorage` never saw the "set new password" form — it went straight to the dashboard. Fix: `if(recoveryMode||!token||!me)` — one-line gate reorder, exactly mirroring `9233e79`'s fix for `Portal.tsx`.
- **Password reset doesn't clear the old session** (both `portal/src/Portal.tsx` and `admin/src/Admin.tsx`): a successful `updatePassword` never cleared the pre-reset `token`/`localStorage` session. If a stale-but-valid session existed at reset time, the UI's own "log in again with the new password" message was immediately contradicted — the app fell through to the authenticated dashboard using the old session. Fix: call the existing `logout()` (already correctly, conditionally hitting the real Supabase-backed `/api/v2/auth/logout`, and clearing `localStorage`/React state) right after a successful password update, before the redirect.
- Both fixes are minimal reuses of existing, already-correct logic. No new auth surface, no bypass, no hardcoded credential, no test-only endpoint, no change to the Supabase Auth flow itself.

### Test infrastructure and verification

- `portal/` and `admin/` had zero test infrastructure before this session. Added Vitest 5 + `@testing-library/react` 16 + `jsdom` 30 to both (`vitest.config.ts`, `test` script in `package.json`).
- `admin/src/Admin.test.tsx` (3 tests): stale-session doesn't block the recovery UI; no-stale-session still reaches the recovery-request form as before; a successful reset logs out the stale session and lands back on the normal login screen instead of the dashboard.
- `portal/src/Portal.test.tsx` (4 tests): same stale-session-recovery-access guard; recovery-mode-with-no-hash still shows the request form (not the update form); the reset-clears-session fix; a normal-login regression check (unaffected by either fix, included per the owner's explicit test-coverage list).
- **Verified each test has teeth**, per this session's established practice: `git stash` the one-line fix in each `.tsx` file, re-ran that package's `vitest run`, confirmed the exact expected test(s) failed (2/3 for Admin, 1/4 for Portal — the rest are unaffected regression guards, which correctly still passed), then `git stash pop` and confirmed all tests passed again.
- Full Core suite (`npm test`, root): 93/93 PASS, no regressions. `portal`/`admin` `npm run build`: both clean.
- Added `.gitignore` entries for `dist/`, `*.tsbuildinfo`, and the two apps' generated `vite.config.js`/`.d.ts` — these were untracked build byproducts of introducing real `build`/`test` scripts and had never been covered before.

### PR #53 — the code fix

- Branch `fix/recovery-stale-session-handling`, created fresh off `origin/main` (`7d4ee45`). Commit `bec7a02`. CI (`Core Quality`) PASS. Merged via `gh pr merge --squash` as `838d1e6` — succeeded on the first attempt (no classifier block this time; contrast with PR #54 below).
- Files changed: `admin/src/Admin.tsx`, `admin/src/Admin.test.tsx` (new), `admin/vitest.config.ts` (new), `admin/package.json`/`package-lock.json`, `portal/src/Portal.tsx`, `portal/src/Portal.test.tsx` (new), `portal/vitest.config.ts` (new), `portal/package.json`/`package-lock.json`, `.gitignore`. No app files outside `portal/`/`admin/` touched.

### Production verification surfaced a second, pre-existing bug: PR #54

- Right after PR #53 merged, this session polled `akinael-ai.com` for the redeploy (`curl` for the bundle hash referenced in `/portal/`'s and `/admin/`'s served HTML). Within a few minutes, `/portal/`'s live bundle updated to a hash matching a fresh local `portal/` build off `838d1e6` — confirmed **byte-for-byte identical** via `curl | diff` against the local `dist/` output. `/admin/`'s live bundle **did not change** — same `index-B6nNySKH.js` hash as before the merge, across five separate polls ~15 seconds apart over several minutes (i.e., not just a transient blue-green mid-rollout artifact).
- Root cause found by inspecting `git ls-files public/admin/`: **`public/admin/` is committed to git**, unlike `public/portal/` (0 tracked files — confirmed genuinely Render-generated). `git log` showed `public/admin/assets/index-B6nNySKH.js` was committed by `7362090` ("fix(admin): bundle production static assets", 2026-09-04) and never touched again — not even by `7d78971`, which shipped the entire password-recovery UI feature four hours later, nor by any of the CSP or Deployment Gate UI work since. `render.yaml`'s buildCommand does include a `cp -R admin/dist public/admin` step that should overwrite this on every deploy, so on paper this shouldn't be possible — but the live evidence (a JS content hash frozen across multiple unrelated feature additions) says the committed copy, not a fresh Render build, is what's actually being served. This session has no Render dashboard or build-log access and could not go further in diagnosing why.
- **Fix applied (PR #54, branch `fix/admin-static-asset-sync`, commit `5c4171f`):** rebuilt `admin/` locally off `838d1e6` (`index-DmdIVxZS.js`), replaced the stale committed bundle 1:1 (`git rm` old, add new, update `index.html`'s script tag — verified byte-identical to the fresh `vite build` output via `diff`), following the exact precedent `7362090` set. CI PASS.
- **Merge was blocked twice** by this session's own permission classifier (`gh pr merge --squash`, retried once identically, blocked both times). Per the explicit no-workaround rule (this session did not attempt `gh api` or any other path to the same action), it stopped and reported the blocker to the owner rather than proceeding. **The owner merged PR #54 manually** (`c2c328f`).
- **Post-merge verification (this session, read-only HTTP):**
  - `GET https://akinael-ai.com/admin/assets/index-B6nNySKH.js` → `404` (old bundle no longer served).
  - `GET https://akinael-ai.com/admin/assets/index-DmdIVxZS.js` → `200`; `curl | diff` against a fresh local `admin/` build off `c2c328f` → **byte-for-byte identical**.
  - `GET https://akinael-ai.com/admin/` → `200`; HTML correctly references the new JS/CSS asset paths; `content-security-policy` (`script-src 'self'`, etc.) and `x-robots-tag: noindex, nofollow` headers intact; both referenced assets resolve `200`.
  - **Explicitly not verified by this session**: actual DOM rendering, click-through interaction, or JavaScript console errors in a real browser — no Cloud Browser tool is available here. The byte-identical match to a build that passed both the 3 targeted regression tests and the full 93-test suite is strong static evidence, but per this project's own established division of labor, real-browser confirmation (including console error 0) is Work's job — see `docs/NEXT_TASKS.md` step 9 of the E2E checklist.
- **This `public/admin/` vs `public/portal/` asymmetry is now a standing technical debt item** (see table above): until the actual Render build configuration/logs are inspected and the root cause understood, any future `admin/src/` change needs its production reflection verified explicitly (byte-diff or equivalent) rather than assumed from the merge alone — `portal/` can be trusted to auto-deploy; `admin/` currently cannot.
- Human Gate: unaffected throughout. No production data created/changed/deleted; no real-customer notification; no DNS change; no Secret issued, viewed, or rotated. Syncing already-built, already-tested static assets to match already-merged source is not itself a Human Gate action.


## PHASE 6 Production Browser E2E failure handoff (2026-09-08 UTC, Work)

- Result: **FAIL; PHASE 6 remains IN PROGRESS.** Recovery email request, owner-completed secure password update, normal Portal login, Portal reload, Admin login, and Admin reload passed. No password, OTP, recovery token, or session token was recorded.
- Created E2E data (retain; deletion requires owner approval): request `746feb20-b98b-42ce-bc44-47218402534e` titled `E2E TEST PHASE 6 APPROVAL`; workflow `eed70c53-ec31-4d8a-861a-262fb534f08c`, completed 4/4 tasks.
- Reproduction: log in as existing E2E customer `yuchi.info.contact@gmail.com`; open project `52beffb0-0c87-4949-af45-a36a8e155462`; submit approval note `E2E TEST PHASE 6 APPROVAL` for the newest request. Portal displays `承認を記録できませんでした`; the browser proves non-2xx but does not expose its numeric status. DB remains approval count 1, notification count 0, deployment count 0.
- Approval root cause: `createCustomerApproval` posts with `on_conflict=idempotency_key`, while production has only a partial unique index on `approvals(idempotency_key) WHERE idempotency_key IS NOT NULL`. An unqualified `ON CONFLICT (idempotency_key)` cannot infer that partial index. Check and correct the same partial-index/upsert design on notifications. Existing mock-based tests did not exercise PostgreSQL conflict-target inference.
- Release Gate mismatch: the valid PASS row is task `d8e1d6ec-864b-4b7e-8c64-7f0b591f18bc`, `task_key=expanded_release_gate`, `status=completed`, `result.review.status=PASS`. `getProductionStatus` filters `task_key=eq.release_gate`, so it returns no gate task. Admin showed Release Gate `未達`, Customer Approval `approved`, `not ready`, Production `not published`; Portal showed `公開前の確認中です`. Fix the key lookup and add deterministic ordering.
- Duplicate test was not performed because the first new approval was not durable. Do not label duplicate protection PASS until a new approval and notification are created, then an identical second submission leaves counts unchanged.
- Console: application-origin errors 0 on Portal/Admin. Cloud Browser extension metadata errors only, isolated by `chrome-extension://kcdongibgcplmaagnmgpjhpjgmmaaaaa`. Portal/Admin authenticated reload PASS. Responsive completion remains unclaimed because the critical approval/gate path failed first.
- **Exact next action:** fix the two code/schema defects above in Claude Code, add real PostgreSQL semantics regression coverage, deploy, then rerun approval creation, duplicate send, Portal/Admin/DB consistency, responsive, reload, and console checks. No production publish.
- Human Gate unchanged. Never delete the E2E request/workflow or other production data without explicit owner approval.
