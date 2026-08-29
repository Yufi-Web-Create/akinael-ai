# アキナエルAI Core API v2

`/api/v2` はSupabase Auth / PostgreSQLへ移行した本番向けAPI境界。
旧 `/api/auth/*` / `/api/projects` は旧UI移行期間だけ残し、新しいCustomer Portalはv2のみを使用する。

## Authentication

Customer PortalはSupabase Authでログインする。
Core APIにはSupabaseのuser access tokenを送る。

```http
Authorization: Bearer <supabase-user-access-token>
```

Core APIはpublishable key + access tokenでSupabase Authへ問い合わせ、user idを検証する。
クライアントから渡されたtenant/customer/user idを権限判定には使用しない。

## Endpoints

### `GET /api/v2/auth/me`

現在のAuth userとアキナエルAIプロフィールを返す。
初回ログイン直後でprofileがない場合も200で返し、`onboardingRequired: true` とする。

### `POST /api/v2/onboarding`

初回顧客アカウントを作成する。

```json
{
  "displayName": "山田太郎",
  "businessName": "山田商店"
}
```

DB内transaction functionにより以下を一括作成する。

- `user_profiles`
- `customers`
- `customer_members`

transaction functionは`service_role`だけが実行可能で、`anon` / `authenticated`から直接呼べない。

### `GET /api/v2/projects`

ログインユーザーが閲覧可能な案件のみ返す。

- customer: `customer_members`に所属するcustomerの案件のみ
- admin: 同一tenantの全案件

### `POST /api/v2/projects`

顧客案件を作成する。
`tenant_id` / `customer_id` はリクエストbodyを信用せず、検証済みuser profile / membershipからCore APIが決定する。

```json
{
  "name": "店舗サイトリニューアル"
}
```

### `GET /api/v2/projects/:projectId`

ログインユーザーに閲覧権限がある案件のみ返す。
権限外の案件は404として扱う。

### `GET /api/v2/projects/:projectId/requests`

案件に紐づく依頼を新しい順で返す。

### `POST /api/v2/projects/:projectId/requests`

顧客の新しい依頼を作成する。
Requestと最初のcustomer messageはDB transaction内で同時作成する。

```json
{
  "type": "web_change",
  "title": "営業時間変更",
  "body": "営業時間を19時までに変更したい",
  "priority": "normal"
}
```

`type`:

- `general`
- `web_new`
- `web_change`
- `copy`
- `social`
- `image`
- `research`
- `automation`
- `seo`
- `other`

このtypeを後続のProduction Routerの一次振り分けに利用する。
AI分類を追加する場合も、顧客入力をそのまま実行命令として扱わず、Core側で正規化する。

### `GET /api/v2/projects/:projectId/messages`

案件のメッセージを時系列で返す。
`?requestId=<uuid>` で依頼単位に絞り込み可能。

### `POST /api/v2/projects/:projectId/messages`

案件に追加メッセージを保存する。

```json
{
  "requestId": "optional-request-id",
  "content": "写真も差し替えたいです"
}
```

`author_user_id` / `author_type` / `tenant_id` / `project_id` はCore APIが検証済みidentityから決定し、クライアント指定を信用しない。

### `GET /api/v2/projects/:projectId/production`

案件の制作進捗を顧客マイページ向けにまとめて返す。

- workflow runs
- tasks
- artifacts（一覧メタデータのみ）
- quality checks

案件の所属確認後、同じ`tenant_id` / `project_id`に限定して取得する。内部モデル名、実行エラー、タスク結果、成果物の保存キーは顧客レスポンスに含めない。

## Production Router boundary

Request作成後、Production Routerが分類し、workflow run / taskへ接続する。顧客マイページはproduction endpointから進捗を参照できる。

## Migration rule

新規Customer Portalはv2 APIのみ利用する。
旧APIへの新機能追加は原則行わない。
旧APIとJSON storeは、新Portal / Admin App移行が完了するまで互換レイヤーとして保持する。
