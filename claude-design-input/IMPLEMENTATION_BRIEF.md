# アキナエルAI UI刷新 + Backend統合 実装指示

## 目的
Claude Designで確定した高忠実度デザインを、既存の本番アーキテクチャ・認証・DB・Workflowを壊さず実装する。
単なる見た目の置換ではなく、顧客マイページ・管理ツールの新UIが実データ・実API・実Workflowで動作するところまで統合する。

## Source repositories
### Core / Backend / Portal / Admin
- `Yufi-Web-Create/akinael-ai`
- 顧客マイページ: `portal/`
- 管理ツール: `admin/`
- Backend / API / Supabase / Workflow: Core repo既存実装

### Public website
- `Yufi-Web-Create/akinael-ai-web`
- Astroベースの公開サイト
- 公開サイトデザイン入力は同repoの `claude-design-input/public-site/` を参照

## 最初に必ず行うこと
Core repoで以下をこの順で読むこと。
1. `AGENTS.md`
2. `CLAUDE.md`
3. `docs/PROJECT_STATUS.md`
4. `docs/HANDOFF.md`
5. `docs/NEXT_TASKS.md`
6. `docs/platform-architecture.md` および関連するDB/API/Workflow資料
7. `claude-design-input/customer-portal/README.md`
8. `claude-design-input/admin-console/README.md`

公開サイトrepoでは `AGENTS.md`、README、CI/E2E構成、`claude-design-input/public-site/README.md` を確認すること。
GitHub上の最新mainをSource of Truthとし、古いhandoffのcommit SHAを固定前提にしない。

## デザイン資料の扱い
Claude Design由来のREADMEはUI/UX仕様のSource of Truthとして扱う。
reference HTML / prototypeは見た目・状態遷移・モーションの参照用であり、productionコードとしてそのままコピーしない。
既存のAstro / React + TypeScript + Vite構成を維持し、既存パターンに合わせて再構築する。

## 1. 公開サイト
対象: `Yufi-Web-Create/akinael-ai-web`

- Astro構成を維持する。
- 新LPデザインをAstroコンポーネントとして再構築する。
- SEO、metadata、OG、robots、sitemap、アクセシビリティ、Playwright E2Eを維持・更新する。
- CTA「AIに相談してみる」は本番の顧客相談導線へ接続する。
- 「ログイン」は本番顧客マイページのログイン導線へ接続する。
- 料金切替、スクリーンショットスライダー、レスポンシブ、focus/hover状態を実装する。
- 料金表示が既存の正式な料金Source of Truthと矛盾する場合は調査して整合させ、課金ロジックを勝手に変更しない。

## 2. 顧客マイページ
対象: `portal/`

- Supabase Authをsource of truthとして維持する。
- localStorage独自token等、廃止済み認証方式を復活させない。
- 顧客、案件、相談、messages、成果物、preview_url、承認記録等の既存機能を壊さない。
- UIでは Workflow / Task / Request / Artifact / Human Gate 等の内部語を出さない。
- デザインREADMEの状態モデルを実DB/Backend状態へadapter層でマッピングする。
- モックのsetTimeoutによる進行は本番に持ち込まず、実イベント/API/DB/Workflowへ接続する。

最低限、以下を実データで動かす:
- ホームのNext Action
- AI相談チャット
- 相談内容の構造化表示
- 金額表示
- 顧客承認
- 修正相談
- 制作進行状態
- 成果物一覧
- 実preview_urlでのプレビュー
- 最終確認/承認状態
- 現在プラン
- Stripe Customer Portalへの安全な導線
- 支払履歴（Backendで提供可能な範囲）
- アカウント設定
- パスワード再設定
- ログアウト

不足するBackend APIがある場合はUIで偽データを作らずCore側へ適切なread/write APIを追加する。

## 3. 管理ツール
対象: `admin/`

- React + TypeScript + Viteの既存構成を維持する。
- 既存adminの認証・権限を維持する。
- mock customers/projects/messagesをproductionコードに残さない。
- 顧客、案件、相談ログ、案件スコープAIチャット、制作物、契約・料金、設定を実データへ接続する。
- 内部ステータスをそのまま表示せずadapter層で日本語業務状態へ翻訳する。
- 「今の状況」はDB生値の羅列ではなく自然文summaryを優先する。
- 承認操作は既存Workflowの正規の承認/再開経路を呼び出す。
- 「修正を指示」は案件スコープの司令塔AIチャットへ接続する。
- 成果物previewは実artifact/preview_urlへ接続する。
- 顧客への確認依頼や公開操作は既存Human Gateを守る。

## 4. Backend調整
UI要件に合わせてBackendを必要最小限調整してよい。ただし既存WorkflowをUI都合で別物に作り直さない。

最初に既存schema/APIを棚卸しし、以下の3分類を作ること:
1. 既存API/DBでそのまま満たせる
2. adapter/aggregationで満たせる
3. Backend追加が必要

追加が必要な場合の優先順位:
1. 既存エンドポイント拡張
2. read model / aggregation API追加
3. 安全なmutation API追加
4. schema変更は最後の手段

DB migrationが必要ならmigration fileを作り既存データ互換を維持する。production DBへの不可逆変更やデータ削除はHuman Gate。

## 状態設計の原則
Frontendが内部実装へ密結合しないようUI用ViewModel/adapterを設ける。
例:
- backend status → customer-facing appState
- backend status → admin-facing status label / next action
- artifacts → works cards
- requests + messages → consultation summary / logs

同じ状態変換を複数画面で重複実装しない。

## 作業ブランチ
mainへ直接実装しない。
推奨:
- Core: `feature/ui-redesign-integration`
- Web: `feature/public-site-redesign`

この `design-input/claude-redesign-20260916` ブランチはデザイン資料の保管用。実装開始時は最新mainから実装ブランチを作り、必要に応じてこのブランチの `claude-design-input/` を参照・取り込むこと。

## 実装順
1. Discovery / Architecture mapping
2. Public site
3. Customer Portal
4. Admin Console
5. Backend gap implementation
6. Unit / component tests
7. Build / lint / typecheck
8. E2E
9. Preview deploymentで実ブラウザ確認
10. PR作成
11. CI PASS確認
12. Human Gateが必要なproduction変更の直前で停止

Frontend実装中にBackend gapが明確な場合は並行修正してよい。

## 絶対条件
- test削除、skip、assertion緩和による偽PASS禁止
- secretsをログ・commitしない
- production dataを削除しない
- E2E用データと実顧客データを混同しない
- production publish、DNS、実顧客通知、決済、追加課金、不可逆production変更はHuman Gate
- 見た目だけで完了判定しない
- placeholder/mockで「接続済み」と扱わない
- preview_urlは実際にブラウザで開けることを確認する
- console error 0を目標にする
- desktop + mobileを確認する

## QA受け入れ条件
### Public site
- デザインと主要レイアウトがhifiで一致
- 主要CTAが正しい本番導線
- pricing toggleが動く
- screenshots crossfadeが動く
- responsive / keyboard / focus statesが正常
- SEO/metadata維持
- CI/E2E PASS

### Customer Portal
- Supabase Auth login/logout/recovery正常
- 実ユーザーで顧客情報表示
- AI相談が実Backendと通信
- 相談内容が実データで生成/表示
- 承認がDB/Workflowへ記録
- 制作状態が実Workflowと同期
- 実成果物/preview_url表示
- 修正依頼が案件文脈付きで送信
- plan/payment導線正常
- mobile navigation正常
- reload/direct access正常
- console error 0

### Admin
- 管理者認証正常
- 顧客/案件/相談/成果物が実データ
- filter/search正常
- admin判断操作が正規Workflowへ反映
- AIチャットが案件スコープで動く
- previewが開く
- Human Gate対象を勝手に実行しない
- desktop/mobile responsive
- console error 0

## 完了報告
- 変更したrepo / branch / commit
- PR URL
- UI実装範囲
- Backend変更一覧
- DB migration有無
- 追加/変更API
- 実データ接続確認結果
- test/lint/typecheck/build結果
- E2E結果
- Preview URL
- 本番反映に残るHuman Gate
- 既知の未解決事項

Core repoの状態・判断が変わった場合は既存ルールに従い `docs/PROJECT_STATUS.md`, `docs/HANDOFF.md`, `docs/NEXT_TASKS.md` も更新すること。
