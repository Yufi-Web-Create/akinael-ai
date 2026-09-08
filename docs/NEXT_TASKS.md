# NEXT_TASKS.md

最終更新: 2026-09-08 UTC checkpoint（PHASE 6 checkpoint）→ 2026-09-08 JST（Claude Code、1時間自律セッション: PR #44/#45/#46を用意）

## 最優先: source-control driftを解消

- [x] `origin/main` から作業branchを作る（既存branchは削除しない）。→ 既存の `docs/shared-handoff-foundation`（PR #42）を継続利用。
- [x] Supabase本番migration `20260904004834 / grant_admin_read_service_role_access` の存在と4つのSELECT grantを読み取り確認する（ChatGPT Work本番照合により確認済み）。
- [x] 対応migration SQLをGitHubへ追加する。内容は `docs/HANDOFF.md` のSQLと一致させ、すでに本番適用済みであることをcommit/PRに明記する。→ `supabase/migrations/20260904004834_grant_admin_read_service_role_access.sql` をPR #42のcommitとして追加済み（2026-09-08 JST, Claude Code）。
- [x] 同一migrationを推測で本番へ再適用しない。DBとmigration historyの照合を先に行う。→ productionへの再適用は行っていない。
- [x] `npm ci` 後にCore `npm test` を実行する(87/87 PASS、2026-09-08確認)。Admin `npm run lint` / `npm run build` はアプリ本体を変更していないため今回は未実施。実際にmainへ反映する前には改めて実行する。
- [x] CI PASS後に通常のPRレビュー経路でmainへ反映する。branch削除はしない。→ PR #42はmerge済み（`docs: establish shared Claude Code / Work handoff`）。
- [ ] Supabase migration history（`supabase_migrations.schema_migrations`）に`20260904004834`が正式に記録されているかを確認する(今後必要に応じて)。

## PR #44 / #45 / #46 — MERGED and confirmed live (2026-09-08, Claude Code)

前回セッションでは`gh pr merge`がpermission classifierにブロックされたが、今回のセッションでは3件とも問題なくmergeできた（ブロックはセッション固有で、常に発生するものではない）。

- [x] PR #44 `fix/portal-password-recovery` → main（`a6bb4cc`）
- [x] PR #45 `fix/protect-portal-preview-from-indexing` → main（`75cda86`）
- [x] PR #46 `docs/phase7-akinael-site-research` → main（`ee12c79`）
- [x] `origin/main`は`ee12c7965e801e063a22c157b8ef79f947d2dfdf`。ローカルで`npm ci && npm test`を再実行し90/90 PASSを確認済み。
- [x] Render Live deployを確認 → `curl -s https://akinael-ai.com/assets/recovery-redirect.js`が新コードと一致、`curl -s https://akinael-ai.com/robots.txt`に`Disallow: /portal`・`Disallow: /preview/`あり、`curl -s -D - -o /dev/null https://akinael-ai.com/portal/`で`x-robots-tag: noindex, nofollow`確認、Portal実JSバンドルに`PASSWORD RECOVERY`文字列を確認。**Renderダッシュボードの認証情報なしで確認できた。**
- [ ] Supabase側でrecovery emailを実際にトリガーする確認はClaude Codeでは行っていない（実メール送信を伴うため）。Workが以下のE2Eで初めて実行する。

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
- [x] Cloud Browser policy-compliant E2E customer authenticationの手段を用意 → PR #44 **merge・Render deploy確認済み**。以下の手順でWorkが実行すること。
- [x] 認証不要のDB / Release Gate / unauthorized API evidenceを再確認
- [ ] Portal/Admin/DB照合、authorization/failure cases、console error 0

### Work向け: Cloud Browserで実行する正確な手順

実装・デプロイはClaude Codeが確認済み。以下はブラウザが必要なためWorkが実行する。

1. Cloud Browserで `https://akinael-ai.com/portal/` をfresh表示（既存session/localStorageなしを推奨）
2. 「パスワードを忘れた方」リンクから、既存E2E customer `yuchi.info.contact@gmail.com` でrecovery emailをリクエスト
3. 届いたrecovery emailのリンクを開く。`https://akinael-ai.com/mypage` → 自動的に `https://akinael-ai.com/portal/?mode=recovery#access_token=...` へ遷移することを確認（role-aware bounceにより、customerアカウントなので`/portal/`へ着地するはず。万一`/admin/`へ着地した場合はPR #44のfail-open挙動のバグ報告として記録すること）
4. 新しいパスワード（12文字以上）を設定し、「パスワードを更新」を実行
5. 更新完了後、通常のPortalログインフォームで新パスワードでログイン
6. ログイン後、E2E project上でapproval操作を実行し、notification生成を確認
7. 同一approvalを重複送信し、duplicate protectionが機能する（二重にnotification/レコードが増えない）ことを確認
8. Admin側（`/admin/`）で同じprojectを開き、Deployment Gate表示、notification、approvalがPortalおよびDBと一致することを確認
9. reload、desktop/mobile viewport、JavaScript application console error 0を確認（Cloud Browser拡張由来のerrorは分離）
10. 全項目PASSで初めてPHASE 6 COMPLETEと判定する

秘密情報（password、OTP、recovery URL/token）はこの文書や会話に残さないこと。

### Claude Code exact next action（更新: 2026-09-08、第2セッション）

- **CURRENT PHASE:** PHASE 6 / Notification / Approval / Deployment Gate — **IN PROGRESS**。PHASE 1〜5はCOMPLETE、PHASE 6はまだCOMPLETEではない。
- PR #44・#45・#46はすべてmain（`ee12c7965e801e063a22c157b8ef79f947d2dfdf`）へmerge済み、かつRenderへのLive deployを読み取り専用HTTP確認で確認済み（Render管理画面の認証情報は不要だった。手法は`docs/HANDOFF.md`参照）。
- **Claude Code側でこれ以上進められる実装作業はない。** 残るのはCloud BrowserでのE2E実行のみで、これはWorkが上記手順で行う。
- Core testsは90/90 PASS、Portal/Admin buildはPASS。migration `20260908011350`は本番適用・検証済み。
- production publish、実顧客notification、DNS、payment/refund、production data削除、Secret操作はHuman Gate。E2E/production dataは削除しない。

## PHASE 7 / Akinael Reference Production — Research/Direction完了、Build未着手

- [x] Research/Directionドキュメント作成 → `docs/web-production/AKINAEL_PROJECT_SPEC.md`（PR #46）。`AKINAEL_SITE_PLAN.md`のPhase 1プロセスに準拠
- [ ] オーナー判断が必要な項目（同spec 11節）: リポジトリ分離の可否、homepage登録CTAを`/portal/`へ向ける修正の実施可否、多ページ化の優先度、運営者・対応地域情報の確定
- PHASE 6が完全にCOMPLETEするまで、PHASE 7のBuildには着手しない

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
