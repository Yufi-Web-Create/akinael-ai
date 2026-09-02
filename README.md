# アキナエルAI バックエンド

資料に定義された責務分離を検証するための、依存なしNode.js APIの初期実装です。

## 起動

```sh
npm start
```

`PORT`で待受ポートを変更できます。`ADMIN_EMAIL` と `ADMIN_PASSWORD` を設定すると起動時に管理者を1名作成できます。

実サービス接続は環境変数で有効化します。LLMは `LLM_API_KEY`（OpenAI互換エンドポイント）、決済は `STRIPE_SECRET_KEY`、メール通知は `RESEND_API_KEY` と `MAIL_FROM` を設定してください。キーがないサービスはモックまたは承認待ちで動作し、キー自体を保存・返却しません。設定例は `.env.example` にあります。

新規登録・相談受付は既定で閉じています。正式な運営者情報、外部向け問い合わせ体制、個人情報取扱いの公開可否について人間・法務の承認が完了した場合に限り、`CUSTOMER_INTAKE_ENABLED=true` を本番環境へ明示設定してください。旧 `/api/*` は廃止済みで、`/api/v2/*` 以外のAPIは利用できません。

主要API:

- 認証: `/api/auth/register`, `/api/auth/login`
- 顧客案件: `/api/projects`, `/api/projects/:id`, `/api/projects/:id/messages`（顧客の送信にはAIが同一レスポンス内で即時応答する）, `/api/projects/:id/tasks`, `/api/projects/:id/artifacts`, `/api/projects/:id/files`, `/api/projects/:id/notifications`
- 管理者: `/api/admin/projects`, `/api/admin/notifications`, `/api/admin/audit-logs`
- AI進行: `/api/admin/projects/:id/workflow`
- 品質検査: `/api/admin/projects/:id/quality-checks`
- 承認: `/api/admin/projects/:id/approvals`（作成・一覧）, `/api/admin/approvals/:id/decision`
- 決済アダプター: `/api/admin/projects/:id/payments`（作成）, `/api/projects/:id/payments`（顧客・管理者とも自案件分を閲覧可）
- 決済Checkout実行: `/api/admin/payments/:id/checkout`（課金承認後のみ）。Checkout完了後の遷移先は `/payment/success`・`/payment/cancel`
- AIタスク実行: `/api/admin/tasks/:id/execute`
- 制作ワークスペース: 案件ごとに専用ワークスペースを作成し、1本のLLM接続を9つの専門ロールへ分担します。顧客ヒアリング、制作ディレクション、調査・戦略、情報設計・UX、コンテンツ編集、ビジュアルデザイン、実装、SEO・アクセシビリティ、品質保証の順で、依存する前工程が完了するまで後工程は実行できません。
- 公開料金・返金ポリシー: `/api/public/pricing`
- 公開ページの窓口AIチャット（未ログイン、会話は保存しない）: `/api/public/chat`
- 顧客サイト公開: `/api/admin/projects/:id/deploy`（公開承認後のみ）
- 管理者設定: `/api/admin/settings`（GET / PUT）
- 外部サービス接続状態: `/api/admin/system-status`

公開、課金、返金、データ削除などの不可逆操作は、決済APIや外部公開APIを直接呼ばず、承認レコードを作成するところで止まります。AIワークフローも `model` を記録するアダプター境界までで、モデルの認証情報や推論結果をコードへ固定していません。

顧客案件ごとにRenderやXServerの設定を繰り返さないため、承認済みHTML成果物は同じWeb Serviceから `/sites/project-XXXXXXXX` で公開します。`POST /api/admin/projects/:id/deploy` の `domain` に顧客ドメインを渡すと案件へ紐付けられ、以後そのHostへのアクセスで配信されます。本番ドメインは `akinael-ai.com` とし、XServer DNSでルートA、`www` CNAME、`*` CNAMEをこのRender Web Serviceへ向けます。

## テスト

ローカルでデータを再起動後も保持する場合は `DATA_FILE=./data/store.json` を設定してください。ファイル本体は `STORAGE_DIR=./data/uploads` へ保存し、JSONには保存キーだけを記録します。保存先は公開ディレクトリ外に置き、権限を制限してください。

開発環境ではローカルの `STORAGE_DIR` を使用できます。本番の推奨はCloudflare R2の非公開バケットです。`OBJECT_STORAGE_PROVIDER=cloudflare-r2` と、`R2_ACCOUNT_ID`、`R2_BUCKET`、`R2_ACCESS_KEY_ID`、`R2_SECRET_ACCESS_KEY` を設定するとアップロード本体をR2へ保存します。アプリケーションのレスポンスにはファイル本体を返しません。

```sh
npm test
```

## デプロイ

Renderを使う場合は `render.yaml` をBlueprintとして登録してください。`ADMIN_EMAIL`、`ADMIN_PASSWORD`、`LLM_API_KEY`、`STRIPE_SECRET_KEY`、`RESEND_API_KEY`、`MAIL_FROM` はRenderのSecretとして入力します。永続ディスクは開発用のJSON・ローカルファイル保存向けです。本番で複数インスタンスへ拡張する場合は、PostgreSQLとS3/R2へ移行してください。

この環境にはDocker CLIと外部ホスティングの認証情報がないため、外部サービスへの本番デプロイ操作は実行していません。デプロイ定義とヘルスチェックは用意済みです。

デフォルトは開発用インメモリストアです。`DATA_FILE` を指定すると再起動後も保持できます。本番利用前には永続DB、マイグレーション、バックアップ、メール送信、実決済プロバイダー、LLMプロバイダー、オブジェクトストレージへ移行してください。認証情報をコードへ埋め込まない前提で、管理者ユーザーの作成APIは意図的に公開していません。リクエストはIP単位で1分30回に制限しています。
