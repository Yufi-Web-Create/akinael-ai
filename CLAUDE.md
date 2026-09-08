# CLAUDE.md

最終更新: 2026-09-08 JST（PHASE 6開始・共通引継ぎ基盤整合）

## このファイルの役割

Claude Code / ChatGPT Work が同じGitHub上の状態から作業を再開するための入口。業務ルールの正本は `AGENTS.md`、現在地は `docs/PROJECT_STATUS.md`、詳細な引継ぎは `docs/HANDOFF.md`、次の作業は `docs/NEXT_TASKS.md`。

## 作業開始時の必読順

1. `AGENTS.md`
2. `docs/PROJECT_STATUS.md`
3. `docs/HANDOFF.md`
4. `docs/NEXT_TASKS.md`

## Current snapshot

- CURRENT PHASE: **PHASE 6 / Notification / Approval / Deployment Gate（IN PROGRESS）**
- PROJECT PROGRESS: **PHASE 5 / 9 COMPLETE**
- PHASE 1〜5: 本番E2Eを含め **COMPLETE**
- PHASE 5: 本番E2EまでCOMPLETE。再実行しない。
- PHASE 6: Notification、Customer Approval、Deployment Gate、Human Gateを本番データ・実ブラウザで検証する。production publish・実顧客通知はHuman Gate。
- **2026-09-08セッション3件目（Claude Code）**: PHASE 7（Astro reference site、別repo `akinael-ai-web`）のBuildをオーナー承認に基づき進行中。その過程でCore repo側の重大な既存不具合を発見・修正: PR #44のpassword recovery機能は`app.js`との実行順序レースにより**実際のブラウザでは機能しない状態のままmerge・deployされていた**（recovery tokenがURLから失われる）。PR #51（`84d9050`、本番反映確認済み）で修正。副次的にCORS対応をPR #50（`ce2e8d2`）で追加（akinael-ai-webのCTAが必要としたため）。**残るPHASE 6のblockerはCloud BrowserでのE2E実行のみ**で、今回の修正により実際に成功する見込みが立った状態。詳細は `docs/HANDOFF.md`・`docs/NEXT_TASKS.md` 参照
- Core repo: `Yufi-Web-Create/akinael-ai`
- `origin/main` HEAD（git上の事実。`git log -1 origin/main`でいつでも再確認可能）: `ce2e8d27f1550e8c296ba4116f3c7ed0fafae962`
  - PR #44/#45/#46/#47/#48/#49/#50/#51のmergeをすべて含む（2026-09-08）。今後mainが進んだらその都度更新する。
- Render Web Service `akinael-ai` live deploy commit: **`ce2e8d2`世代のコードがLive配信中であることを確認済み**（2026-09-08、Render管理画面ではなく本番URLへの読み取り専用HTTP確認による。手法は`docs/HANDOFF.md`参照）。`origin/main` HEADとは独立した運用上の事実として扱う。Renderは`main`へのpushで自動deployする（確認済み）。
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

本番Supabaseには `grant_admin_read_service_role_access`（version `20260904004834`）が適用済み。この記録はPR #42経由でmain（`docs/shared-handoff-foundation`）へmerge済み。merge後も本番へ再適用しない。

**mainへのPR mergeはセッションによって許可されたり、classifierにブロックされたりする**（2026-09-08、同日の別セッションで`gh pr merge`がブロックされた実例と、成功した実例の両方あり）。CI PASS・review PASSであれば`gh pr merge`を試みてよい。ブロックされた場合は代替手段（force push、直接push等）を試みず、blockerとして記録し次の独立作業へ進む。

## セッション終了前

実装・本番状態・判断が変わったら、終了前に次を更新する。

- `docs/PROJECT_STATUS.md`
- `docs/HANDOFF.md`
- `docs/NEXT_TASKS.md`

E2Eデータ削除とbranch削除は、文書整理の一環でも実行しない。
