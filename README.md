# アキナエルAI バックエンド

資料に定義された責務分離を検証するための、依存なしNode.js APIの初期実装です。

## 起動

```sh
npm start
```

`PORT`で待受ポートを変更できます。`ADMIN_EMAIL` と `ADMIN_PASSWORD` を設定すると起動時に管理者を1名作成できます。

実サービス接続は環境変数で有効化します。LLMは `LLM_API_KEY`（OpenAI互換エンドポイント）、決済は `STRIPE_SECRET_KEY`、メール通知は `RESEND_API_KEY` と `MAIL_FROM` を設定してください。キーがないサービスはモックまたは承認待ちで動作し、キー自体を保存・返却しません。設定例は `.env.example` にあります。

新規登録・相談受付は既定で閉じています。正式な運営者情報、外部向け問い合わせ体制、個人情報取扱いの公開可否について人間・法務の承認が完了した場合に限り、`CUSTOMER_INTAKE_ENABLED=true` を本番環境へ明示設定してください。プロダクション入口では旧 `/api/*` をすべて廃止し、`/api/v2/*` 以外のAPIは利用できません。

主要API（すべて `/api/v2`）:

- 認証: `POST /api/v2/auth/register`, `POST /api/v2/auth/login`, `POST /api/v2/auth/logout`, `GET /api/v2/auth/me`
- オンボーディング: `POST /api/v2/onboarding`
- 顧客案件: `GET` / `POST /api/v2/projects`, `GET /api/v2/projects/:id`
- 案件リクエスト: `GET` / `POST /api/v2/projects/:id/requests`
- 案件メッセージ: `GET` / `POST /api/v2/projects/:id/messages`
- 制作状況: `GET /api/v2/projects/:id/production`

旧 `/api/*` エンドポイント（旧ログイン、顧客案件・メッセージ、公開チャット、管理APIを含む）は完全に廃止され、常に `410 legacy_api_retired` を返します。旧認証・セッション経由で同意未記録の顧客入力をLLMへ送信する経路は提供しません。旧UIの `/admin`、`/admin-login`、`/mypage` も配信しません。管理機能は、厳格なv2管理者認可と既存の承認ゲートを実装した新UIが完成するまで再公開しません。

公開、課金、返金、データ削除などの不可逆操作は、決済APIや外部公開APIを直接呼ばず、承認レコードを作成するところで止まります。AIワークフローも `model` を記録するアダプター境界までで、モデルの認証情報や推論結果をコードへ固定していません。

顧客サイトの本番公開・ドメイン紐付けは、このリポジトリの公開APIでは実行しません。旧管理APIは廃止済みであり、公開機能を再開する場合はv2の管理経路、厳格な管理者認可、人間の公開承認、ロールバック手順を実装・レビューしてから扱います。

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
