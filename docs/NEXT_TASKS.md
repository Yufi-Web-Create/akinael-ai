# NEXT_TASKS.md

最終更新: 2026-09-07 UTC / 2026-09-08 JST（ChatGPT Work本番照合）→ 2026-09-08 JST（Claude Code、migration drift解消タスクを更新）

## 最優先: source-control driftを解消

- [x] `origin/main` から作業branchを作る（既存branchは削除しない）。→ 既存の `docs/shared-handoff-foundation`（PR #42）を継続利用。
- [x] Supabase本番migration `20260904004834 / grant_admin_read_service_role_access` の存在と4つのSELECT grantを読み取り確認する（ChatGPT Work本番照合により確認済み）。
- [x] 対応migration SQLをGitHubへ追加する。内容は `docs/HANDOFF.md` のSQLと一致させ、すでに本番適用済みであることをcommit/PRに明記する。→ `supabase/migrations/20260904004834_grant_admin_read_service_role_access.sql` をPR #42のcommitとして追加済み（2026-09-08 JST, Claude Code）。
- [x] 同一migrationを推測で本番へ再適用しない。DBとmigration historyの照合を先に行う。→ productionへの再適用は行っていない。
- [x] `npm ci` 後にCore `npm test` を実行する(87/87 PASS、2026-09-08確認)。Admin `npm run lint` / `npm run build` はアプリ本体を変更していないため今回は未実施。実際にmainへ反映する前には改めて実行する。
- [ ] CI PASS後に通常のPRレビュー経路でmainへ反映する。branch削除はしない。→ PR #42はDraftのまま。mainへのmergeは指示により保留中。
- [ ] Supabase migration history（`supabase_migrations.schema_migrations`）に`20260904004834`が正式に記録されているかを確認する(今後必要に応じて)。

## PHASE 5 / Admin最終E2E

既存データを使用し、新規production dataは不要。ログインはCloud Browserの安全な認証入力を使い、password/OTPをチャット・ログへ出さない。

- [x] 実Supabase Auth管理者アカウント作成
- [x] password recovery / update
- [x] `user_profiles.role = admin`
- [x] customer role 403 / unauthenticated 401
- [x] Cloud BrowserでAdmin実ログイン
- [x] 管理者メールと案件一覧表示
- [x] overviewの本番権限障害を原因特定・本番修正
- [x] `E2E｜月灯り珈琲 新規Webサイト` の `deploy_ready`, workflow completed, 21/21 tasks表示
- [ ] Project `52beffb0-0c87-4949-af45-a36a8e155462` を選択し、最新workflow `baa79515-498b-4b38-b6a6-3d812fedf262` を基準に確認
- [ ] 概要: completed/completed、対応必要なし、Human Gate自動実行なし
- [ ] 依頼・会話: final request `8b94664a-8851-4de1-b447-58dc045cafe2` と4 messages
- [ ] Workflow: 最新workflow単体で16/16 tasks、Build/4 Review/Release Gate completed（project集計は初回失敗分を含み20/23）
- [ ] 成果物・品質: preview artifactsとRelease Gate artifact PASS
- [ ] artifactのpreview linkから実URLをCloud Browserで開き、画面表示成功を確認
- [ ] 承認: `35ec6138-1e0d-4b30-829d-a7baa4d9a70e` が `delivery / approved`
- [ ] 運用記録: repository/deployment/audit表示。deploymentsが空配列なら「本番公開未実行」の正しい状態として確認
- [ ] reload後もAdmin認証・画面が正常
- [ ] desktop viewport表示
- [ ] mobile viewport表示
- [ ] JavaScript application console error 0
  - `chrome-extension://kcdongibgcplmaagnmgpjhpjgmmaaaaa/...` のCloud Browser拡張metadata errorはアプリ起因ではないため分離記録
- [ ] Supabase Auth log / API結果とPortal表示を突合し、UI表示だけでPASSにしない

## PHASE 5 completion report

全項目PASS後のみ次で報告する。

```text
PHASE COMPLETE
PHASE 5 / Admin完成

RESULT
PASS

COMPLETED
...

VERIFIED
- Admin Auth user/profile
- project/workflow/task/artifact/approval IDs
- preview URL / Cloud Browser実表示
- reload / desktop / mobile
- application console error 0

FIXED
...

REMAINING
- 削除していないE2Eデータ一覧
- 削除にはオーナー確認が必要

PROJECT PROGRESS
PHASE 5 / 9 COMPLETE

NEXT PHASE
PHASE 6 / Notification / Approval / Deployment Gate

HUMAN GATE
NO
```

## PHASE 6以降

PHASE 5 COMPLETE後に着手。PHASE 6名は `Notification / Approval / Deployment Gate`。production公開、DNS、実顧客通知、payment、データ削除、Secret操作はHuman Gate。

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
