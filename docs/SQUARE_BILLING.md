# Square Billing

アキナエルAIの顧客向け月額課金はSquare Subscriptions + Square-hosted Checkoutを使用する。

## 料金のSource of Truth

アキナエルAI側の料金・プラン名は `src/business-config.mjs` をSource of Truthとする。

- `mini`: 本契約ミニ / 3,980円/月
- `operations`: しっかり運用 / 7,980円/月
- `advanced`: 発展運用 / 17,800円/月

Square側では各プランに対応するSubscription Plan Variationを作成し、Variation IDを環境変数で紐づける。

## 必須環境変数

```env
PAYMENT_PROVIDER=square
SQUARE_ENVIRONMENT=sandbox
SQUARE_API_VERSION=2026-09-16
SQUARE_ACCESS_TOKEN=...
SQUARE_LOCATION_ID=...
SQUARE_WEBHOOK_SIGNATURE_KEY=...
SQUARE_PLAN_VARIATION_MINI=...
SQUARE_PLAN_VARIATION_OPERATIONS=...
SQUARE_PLAN_VARIATION_ADVANCED=...
```

SandboxでE2Eを完了後、`SQUARE_ENVIRONMENT=production` とProduction用Access Token / Location / Plan Variation IDs / Webhook Signature Keyへ切り替える。

## Webhook

登録URL:

```text
https://akinael-ai.com/api/v2/billing/webhook
```

購読イベント:

- `payment.updated`
- `subscription.created`
- `subscription.updated`

署名検証には `x-square-hmacsha256-signature` を使用する。Square側に登録したNotification URLと、アプリの `PUBLIC_URL + /api/v2/billing/webhook` は完全一致させる。異なるURLを登録する場合のみ `SQUARE_WEBHOOK_NOTIFICATION_URL` を明示する。

## 顧客フロー

1. 顧客が制作物を承認し「プラン・お支払い」へ進む。
2. `mini` / `operations` / `advanced` を選択する。
3. Core APIがSquare Payment Linkを作成する。
4. 顧客はSquare-hosted Checkoutでカード情報を入力し、月額契約を開始する。
5. `payment.updated` Webhookで内部顧客とSquare Customerを紐づけ、支払い履歴を `payments` へ記録する。
6. Square Subscriptionを検索し、`customers.square_subscription_id` と `customers.plan_id` を同期する。
7. プラン変更は `/api/v2/billing/change-plan` からSquare `swap-plan` を呼ぶ。
8. 解約は `/api/v2/billing/cancel` からSquareの解約APIを呼び、請求期間終了時に終了する。

## DB

`customers`:

- `plan_id`
- `square_customer_id`
- `square_subscription_id`

`payments`:

- `provider = square`
- `provider_reference = Square payment id`
- `kind = subscription`
- `amount`
- `currency`
- `status`

Stripe由来の既存列はロールバック・履歴保全のため即時削除せず、アクティブなv2課金フローからは参照しない。

## Sandbox確認手順

1. Square Developer DashboardでSandbox Appを用意する。
2. Sandbox Locationを確認する。
3. 3つのSubscription Plan Variationを作成する。
4. RenderへSandboxの環境変数を設定する。
5. Webhookを登録し、3イベントを購読する。
6. テスト顧客で初回Checkoutを完了する。
7. Portalへ戻り、現在プランが反映されることを確認する。
8. `payments` にSquare決済が1件だけ記録されることを確認する。
9. プラン変更を行い、Square Subscriptionの変更予約を確認する。
10. 解約を行い、期間終了時の解約予約を確認する。

実課金開始前にProduction用の同一構成へ切り替え、少額・管理下のアカウントで最終E2Eを行う。
