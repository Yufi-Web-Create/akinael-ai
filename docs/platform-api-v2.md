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

Request example:

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

## Migration rule

新規Customer Portalはv2 APIのみ利用する。
旧APIへの新機能追加は原則行わない。
旧APIとJSON storeは、新Portal / Admin App移行が完了するまで互換レイヤーとして保持する。
