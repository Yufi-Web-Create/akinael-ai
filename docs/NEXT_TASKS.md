# NEXT_TASKS.md

最終更新: 2026-09-08（Claude Codeセッション、リポジトリ監査 + ChatGPT Work引き継ぎ情報の統合により作成）

現状の詳細は [docs/PROJECT_STATUS.md](PROJECT_STATUS.md)、アーキテクチャと技術的負債の詳細は [docs/HANDOFF.md](HANDOFF.md) を参照。

## 進行中: PHASE 5 完了のための残タスク（本番ブラウザE2E）

PHASE 5 COMPLETEの条件は以下すべてのPASS。unit test / build / CI成功だけでは不可（[CLAUDE.md](../CLAUDE.md) の Completion Rule参照）。

検証には既存のPHASE 4 E2Eデータを使用する（**削除禁止**）。特に Project `52beffb0-0c87-4949-af45-a36a8e155462` を使用できる。

- [ ] 実Supabase Authでの管理者ログイン
- [ ] admin profileの生成確認
- [ ] PHASE 4で作成した本番E2E顧客データがAdminに正しく表示されること
  - [ ] customer
  - [ ] project
  - [ ] request
  - [ ] messages
  - [ ] workflow
  - [ ] artifacts
  - [ ] approval
- [ ] Admin主要操作の動作確認
- [ ] reload後の状態保持確認
- [ ] desktop viewportでの表示確認
- [ ] mobile viewportでの表示確認
- [ ] JavaScript application console errorが0件であること

全項目PASSするまでPHASE 5をCOMPLETEにしない。

## 未着手: PHASE 6〜9（詳細スコープ未定義）

以下はPHASE名のみ引き継がれており、詳細な受け入れ条件はまだ確定していない。着手前に正式な要件確認が必要（推測でスコープを広げない）。

- PHASE 6: Notification / Approval / Deployment Gate
- PHASE 7: Akinael Reference Production
- PHASE 8: Full Production QA
- PHASE 9: Production Release

## 記録済み技術的負債（現PHASE完了を妨げる具体的不具合が確認されるまで着手禁止）

詳細は [docs/HANDOFF.md](HANDOFF.md) の「既知の技術的負債」を参照。ここでは見落とし防止のため一覧のみ再掲する。

- 未マージリモートbranch 40件 — **削除禁止**。個別精査もまだ実施していない。
- `portal/app/` のNext.js残骸 — 現行Vite buildからは未参照。放置。
- `Dockerfile` の陳腐化（render.yamlの実ビルド手順と乖離）— 放置。
- v1 legacy API（`src/server.mjs`）とv2 API共存 — `docs/platform-architecture.md`の移行方針に従い段階的に進める前提。今回は着手しない。
- `public/admin/`（commit済み）と`public/portal/`（未commit）の非対称性 — 放置。

## 継続確認が必要な未解消の引き継ぎギャップ

- 40件のbranchそれぞれの内容・意図の個別精査（未実施）
- secret / APIキーの管理場所の明文化（未確認）
- 実顧客契約データの有無（PHASE 4データがテスト目的か実顧客かの明言なし）

## セッション終了時にやること

このファイルを含む3ファイル（`docs/PROJECT_STATUS.md`, `docs/HANDOFF.md`, `docs/NEXT_TASKS.md`）を必ず更新してからセッションを終える（[CLAUDE.md](../CLAUDE.md) のルール参照）。
