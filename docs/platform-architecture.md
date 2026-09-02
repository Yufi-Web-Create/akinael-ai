# アキナエルAI プラットフォーム構成

## 役割分離

### `akinael-ai`
Core API / Orchestrator。
顧客案件、Request分類、AI workflow、承認、決済、通知、GitHub制作パイプライン起動、デプロイ管理を担当する。

### `akinael-ai-web`
公開Webサイト専用。
マーケティングサイトとサービス説明を担当し、Coreの内部業務ロジックを持たない。

### Customer Portal
顧客マイページ。Next.jsで別アプリとして構築する。
Supabase Authでログインし、案件・依頼・メッセージ・成果物・承認・決済状況を表示する。

### Admin App
社内管理画面。初期はRetoolを使用し、Core API / Supabaseを通して案件全体を管理する。

## データ基盤

正式DBは既存Supabase project `misesapo-dev` を継続利用する。
`misesapo-dev-v2` は現時点では利用しない。

Supabaseの責務:
- Auth
- PostgreSQL
- RLSによる顧客データ分離
- 顧客・案件・Request・workflow・成果物・承認・決済・通知・deployment metadata

Core APIの責務:
- secret keyを必要とするサーバー処理
- AI実行
- GitHub操作
- Stripe / Resend等の外部サービス操作
- 不可逆操作の承認Gate

ブラウザへ `SUPABASE_SECRET_KEY` を公開しない。
新規実装では `sb_publishable_...` / `sb_secret_...` を優先し、legacy anon/service_role keyは移行互換のみとする。

## 現行DB

既存:
- tenants
- customers
- user_profiles
- customer_members
- projects

追加済み:
- requests
- messages
- workflow_runs
- tasks
- artifacts
- quality_checks
- approvals
- payments
- notifications
- repositories
- deployments
- audit_logs

## Production request flow

Customer Portal
→ request作成
→ Core API Request Router
→ Pipeline判定
→ GitHub workspace / repository
→ Research（必要時）
→ Direction
→ Build
→ Automated QA
→ Independent Review
→ Correction loop
→ DEPLOY READY
→ 顧客/管理者承認
→ Production deploy

Research / QA /修正などAI内部で解決可能な工程では人間確認のため停止しない。
本番公開、DNS切替、新規課金、破壊的操作、正式情報不足のみHuman Gate対象とする。

## 移行方針

旧Node in-memory / JSON storeは移行期間だけ残す。
一度に全APIを書き換えず、Repository境界を通して以下の順にSupabaseへ移す。

1. Auth / user profile
2. customers / projects
3. requests / messages
4. workflow runs / tasks / artifacts / quality checks
5. approvals / payments / notifications
6. repositories / deployments / audit logs
7. JSON persistence撤去
8. Render persistent disk依存撤去

旧 `public/admin.html` と `public/mypage.html` は本番UIとしては廃止する。機能要件の参考としてのみ保持し、新Admin App / Customer Portal完成後に削除する。これらのUIは旧 `/api/*` を呼び出すため、本番エントリポイントでは `/admin`、`/admin-login`、`/mypage` を配信しない。管理機能の再公開は、v2の厳格な管理者認可と既存の人間承認ゲートを実装・レビューした新UIに限る。
