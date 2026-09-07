# CLAUDE.md

最終更新: 2026-09-07 UTC / 2026-09-08 JST（ChatGPT Work本番照合）

## このファイルの役割

Claude Code / ChatGPT Work が同じGitHub上の状態から作業を再開するための入口。業務ルールの正本は `AGENTS.md`、現在地は `docs/PROJECT_STATUS.md`、詳細な引継ぎは `docs/HANDOFF.md`、次の作業は `docs/NEXT_TASKS.md`。

## 作業開始時の必読順

1. `AGENTS.md`
2. `docs/PROJECT_STATUS.md`
3. `docs/HANDOFF.md`
4. `docs/NEXT_TASKS.md`

## Current snapshot

- CURRENT PHASE: **PHASE 5 / Admin完成（IN PROGRESS）**
- PROJECT PROGRESS: **PHASE 4 / 9 COMPLETE**
- PHASE 1〜4: 本番E2Eを含め **COMPLETE**
- PHASE 5: 実装・本番配信・管理者Auth・Admin実ログイン・案件概要表示まで確認済み。6タブ横断、reload、desktop/mobile、実preview再表示、application console error 0の最終E2Eが未完了。
- Core repo: `Yufi-Web-Create/akinael-ai`
- `origin/main`: `e2c2f8cb60208f47586f7098fb368854c0b6010d`
- 共通引継ぎ文書branch: `docs/shared-handoff-foundation`
- Production: https://akinael-ai.com/
- Customer Portal: https://akinael-ai.com/portal/
- Admin: https://akinael-ai.com/admin/
- Supabase project ref: `rxxmbnlqomtfjekdrblo`

## Completion rule

unit test / lint / build / CI成功だけでは完了ではない。**本番ブラウザと本番データが最終source of truth**。表示だけでなく、リンク先の実previewもCloud Browserで開いて確認する。

## Human Gate

以下は必ずオーナー確認後に実行する。

- 新しい有料契約・追加課金
- production DNS変更・本番公開
- 実顧客通知
- 決済・返金
- production data削除
- Secretの発行・再発行・失効
- 不可逆なproduction変更
- 正式情報不足・法務リスク

Research / Direction / Build / QA / Reviewの通常処理と、非破壊的な原因調査・再試行は自律進行する。

## 絶対にしないこと

- テストの削除・skip・条件緩和による偽PASS
- DB statusの手動書換えによる偽PASS
- Secret、パスワード、OTP、recovery token、service role keyの表示・保存・commit
- 本番E2Eデータの削除
- 未マージremote branchの削除
- 実顧客データとE2Eデータの混同

## 現在の重要注意

本番Supabaseには `grant_admin_read_service_role_access`（version `20260904004834`）が適用済みだが、対応するmigration SQLはまだ `origin/main` に存在しない。次のセッションは `docs/NEXT_TASKS.md` の手順でsource-control driftを解消すること。すでに本番適用済みなので、効果確認なしに同じ推測修正を繰り返さない。

## セッション終了前

実装・本番状態・判断が変わったら、終了前に次を更新する。

- `docs/PROJECT_STATUS.md`
- `docs/HANDOFF.md`
- `docs/NEXT_TASKS.md`

E2Eデータ削除とbranch削除は、文書整理の一環でも実行しない。
