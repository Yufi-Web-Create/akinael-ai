# CLAUDE.md

## このファイルについて

このリポジトリで作業するすべてのセッション（Claude Code / ChatGPT Work のどちらでも）に共通する運用ルールを定義する。

プロジェクト固有の業務ルール・非交渉事項（テストを弱めない、承認ゲートを守る、架空の事業情報を作らない等）は [AGENTS.md](AGENTS.md) が正本であり、本ファイルはそれと矛盾しない。作業前に必ず AGENTS.md も確認すること。

## プロジェクト概要

アキナエルAI — 小規模店舗向けWeb改善・自動制作サービスの、本番稼働中のシステム。

- Core repository: `Yufi-Web-Create/akinael-ai`（このリポジトリ）
- Customer repository organization: `akinael-ai-clients`
- Production: https://akinael-ai.com/（Customer Portal: `/portal/`、Admin: `/admin/`）
- Supabase project ref: `rxxmbnlqomtfjekdrblo`
- GitHub App: `akinael-ai-runtime-yufi`（App ID `4762113`）— `Yufi-Web-Create/akinael-ai` と `akinael-ai-clients` Organization にインストール済み

秘密鍵・APIキーなどのSecret値は**絶対に表示・取得・出力しない**。

## 作業を始める前に必ず読むもの

1. [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) — 現在のPHASE状況と本番で確認済みの事実
2. [docs/HANDOFF.md](docs/HANDOFF.md) — アーキテクチャの詳細、既知の技術的負債、引き継ぎギャップ
3. [docs/NEXT_TASKS.md](docs/NEXT_TASKS.md) — 次に着手すべき具体的な作業
4. [AGENTS.md](AGENTS.md) — 業務ルール・非交渉事項・料金/承認ゲートの正本

この3ファイル（PROJECT_STATUS / HANDOFF / NEXT_TASKS）だけを読めば、どのセッションでも推測なしに正確に作業を再開できる状態を維持すること。

## Completion Rule（完了の定義）

unit test / build / CI が成功することは「完了」を意味しない。**本番環境での実動作が最終的なsource of truth**である。PHASEを完了扱いにするのは、本番ブラウザ・実データでの検証がPASSした場合のみ。

## Human Gate（人間承認が必須な操作）

以下は自律判断で実行せず、必ず人間に確認してから進める。

- 新しい有料サービスの開始
- production DNS変更・新規公開
- 実顧客への通知送信
- payment（決済）操作
- production dataの削除
- secretの発行・失効
- 不可逆なproduction変更
- 正式な事業情報が不足し推測できない場合

上記以外（Research、Direction、Build、QA fail、Review failなどの内部工程）は原則として停止せず自律的に進める。

## 現時点で「既知の技術的負債」として記録済み、勝手に触ってはいけないもの

以下は監査で見つかっているが、現在のPHASE完了を妨げる具体的な不具合が確認されるまでは**削除・整理・再構築しない**。

- リモートの未マージ branch 40件 — **削除禁止**
- `portal/app/` 配下のNext.js残骸（現行ビルドはVite。`portal/app` は現行buildから未参照）
- `Dockerfile`（render.yamlの実ビルド手順と乖離した旧定義）
- v1 legacy API（[src/server.mjs](src/server.mjs)）とv2 API（[src/platform-api.mjs](src/platform-api.mjs)）の共存
- `public/admin/`（ビルド成果物をcommit済み）と`public/portal/`（未commit）の非対称性

詳細と経緯は [docs/HANDOFF.md](docs/HANDOFF.md) の「既知の技術的負債」を参照。

## セッション終了前の必須ルール

**このリポジトリで作業したセッションは、終了前に必ず以下の3ファイルを最新化すること。**

1. `docs/PROJECT_STATUS.md` — PHASE状況、直近で確認・変更した事実、更新日
2. `docs/HANDOFF.md` — アーキテクチャ理解に変化があれば更新し、新たに見つかった技術的負債を追記
3. `docs/NEXT_TASKS.md` — 完了したタスクを外し、新たに必要になった作業を追加

これはClaude CodeでもChatGPT Workでも同じルールであり、次のセッションがGitHub上のこの3ファイルだけを読めば正確に再開できる状態を保つことが目的。**更新せずにセッションを終えることは禁止。**

## 禁止事項（現時点）

- アプリケーション本体のコード変更（明示的な実装指示がある場合を除く）
- production deployの実行
- git branchの削除
- 本番E2Eデータの削除（特に project `52beffb0-0c87-4949-af45-a36a8e155462` はPHASE 5検証に使用中のため保持すること）
- secret / APIキーの値の表示・出力
