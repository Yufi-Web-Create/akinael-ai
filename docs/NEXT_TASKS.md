# NEXT_TASKS.md

最終更新: 2026-09-08 UTC checkpoint（PHASE 6 checkpoint）

## 最優先: source-control driftを解消

- [x] `origin/main` から作業branchを作る（既存branchは削除しない）。→ 既存の `docs/shared-handoff-foundation`（PR #42）を継続利用。
- [x] Supabase本番migration `20260904004834 / grant_admin_read_service_role_access` の存在と4つのSELECT grantを読み取り確認する（ChatGPT Work本番照合により確認済み）。
- [x] 対応migration SQLをGitHubへ追加する。内容は `docs/HANDOFF.md` のSQLと一致させ、すでに本番適用済みであることをcommit/PRに明記する。→ `supabase/migrations/20260904004834_grant_admin_read_service_role_access.sql` をPR #42のcommitとして追加済み（2026-09-08 JST, Claude Code）。
- [x] 同一migrationを推測で本番へ再適用しない。DBとmigration historyの照合を先に行う。→ productionへの再適用は行っていない。
- [x] `npm ci` 後にCore `npm test` を実行する(87/87 PASS、2026-09-08確認)。Admin `npm run lint` / `npm run build` はアプリ本体を変更していないため今回は未実施。実際にmainへ反映する前には改めて実行する。
- [ ] CI PASS後に通常のPRレビュー経路でmainへ反映する。branch削除はしない。→ PR #42はDraftのまま。mainへのmergeは指示により保留中。
- [ ] Supabase migration history（`supabase_migrations.schema_migrations`）に`20260904004834`が正式に記録されているかを確認する(今後必要に応じて)。

## PHASE 5 / Admin最終E2E — COMPLETE

既存E2Eデータだけを使用し、新規production dataは作成していない。認証はCloud Browserの安全な認証入力を使用し、password/OTP/tokenをチャット・ログ・文書へ出していない。

- [x] 実Supabase Auth管理者ログイン
- [x] admin profile（user `4b9af2d3-f500-4f5e-bced-0decf88f8feb`、role `admin`）をDB確認
- [x] PHASE 4 project `52beffb0-0c87-4949-af45-a36a8e155462` を選択
- [x] 概要、依頼・会話、Workflow、成果物・品質、承認、運用記録の6タブを実データで確認
- [x] 最新workflow `baa79515-498b-4b38-b6a6-3d812fedf262` をDB基準で確認（`completed / completed`、tasks `16/16` completed）。Admin全体集計`20/23`は初回失敗workflowを含むことを確認
- [x] 成果物タブの実previewリンクからartifact `8c84cd57-8850-4401-9f36-c6127316a68c` をCloud Browserで開き、実画面描画成功
- [x] 承認 `35ec6138-1e0d-4b30-829d-a7baa4d9a70e` の `delivery / approved` をDB／Admin表示で確認
- [x] reload後の認証維持・案件再表示
- [x] desktop `1363×936`、tablet `768×1024`、mobile `390×844` 実表示
- [x] JavaScript application console error 0
  - `chrome-extension://kcdongibgcplmaagnmgpjhpjgmmaaaaa/...` のCloud Browser拡張metadata error（Admin 21件）はアプリ起因ではないため分離
- [x] 主要な読取操作、タブ遷移、preview表示で403/500/不整合なし

## PHASE 5 completion report

- RESULT: **PASS**
- Human Gate: **NO**
- 修正・deploy: 今回の最終E2Eでは不要（本番コード変更なし）。
- E2Eデータ、production data、remote branchは削除していない。削除にはオーナー確認が必要。

## PHASE 6 / Notification / Approval / Deployment Gate — IN PROGRESS

- [x] Branch / Draft PR #43を作成し、v2 deploymentGate／Portal通知表示の初期実装を保存
- [x] Core tests 87/87、Portal/Admin build
- [x] DB-level duplicate/idempotency制約とnotification failure handlingを実装・本番schema検証（migration `20260908011350` 適用済み）
- [x] Admin notification/deployment gate表示を実装
- [x] PR #43 CI・independent review・merge（Core Quality `34176064714` PASS、main `45e449e`）
- [x] Render blocker解消：owner確認済み。Render Web main `a6d3e828ad89148448ee02b4520c46b631dc1009` はDeploy succeeded / Live、fresh AdminでPHASE 6新UIを表示。
- [ ] E2E TESTデータによるNotification / Approval / Deployment Gate本番検証
- [ ] Cloud Browser policy-compliant E2E customer authentication（新規登録はbrowser safety policyにより未実行）
- [x] 認証不要のDB / Release Gate / unauthorized API evidenceを再確認
- [ ] Portal/Admin/DB照合、authorization/failure cases、console error 0

### Claude Code exact next action (final checkpoint)

- **CURRENT PHASE:** PHASE 6 / Notification / Approval / Deployment Gate — **IN PROGRESS**。PHASE 1〜5はCOMPLETE、PHASE 6はまだCOMPLETEではない。
- 唯一のblockerはCustomer Portal authenticated production-browser E2E。既存E2E customerは`yuchi.info.contact@gmail.com`だが、Portal sessionはなく、現Portalには安全なpassword recovery/passwordless導線がない。Cloud Browserによる新規customer作成はポリシー拒否であり、回避策は使用していない。
- **Claude Codeは正式なCustomer Portal password recovery導線を実装**し、その安全な導線で既存E2E customerを認証してから、Notification / Approval / Deployment Gateの本番E2E、Portal/Admin/DB整合、authorization/failure、console error 0を完了すること。
- PHASE 6 implementationはmain `45e449e94ee6275285438d5d2ad2a87c1bc419fa`へ反映済み、migration `20260908011350`は本番適用・検証済み、Core testsは88/88 PASS、Portal/Admin buildはPASS。Render blockerは解消済み。
- production publish、実顧客notification、DNS、payment/refund、production data削除、Secret操作はHuman Gate。E2E/production dataは削除しない。

production公開、DNS、実顧客通知、payment、データ削除、Secret操作はHuman Gate。

## 再実行不要

- PHASE 1〜4のWorkflow再作成・再実行
- PortalのNext.jsへの戻し、hydration問題の再調査
- PHASE 4 preview URL生成/紐付けの再実装
- recovery redirect/CSPの同じ推測修正
- Adminアカウント再作成、roleの手動変更、password再送
- Render Worker / GitHub Appを「未設定」と仮定した再構築
- E2Eデータのclean-up（明示承認まで禁止）

## 禁止

- E2E/production data削除
- branch削除
- DB status手動偽装
- 実顧客通知、課金、返金、公開、DNS変更
- Secret値の取得・表示・commit・再発行
