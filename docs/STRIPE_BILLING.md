# Stripe Billing setup

アキナエルAIの顧客ポータルから、月額プランの初回契約をStripe Checkoutで受け付け、契約後はStripe Billing Portalでカード情報・請求履歴・解約を管理します。

## 必須環境変数

RenderのCore Web Serviceに以下を設定します。

- `STRIPE_SECRET_KEY`: StripeのSecret key。サーバー側だけで使用します。
- `STRIPE_WEBHOOK_SECRET`: 下記Webhook endpoint用のSigning secret。
- `PUBLIC_URL`: 本番では `https://akinael-ai.com`。

Secret key / Signing secretをGitHubへコミットしないでください。

## Stripe Webhook

Endpoint:

`https://akinael-ai.com/api/v2/billing/webhook`

購読するイベント:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

Webhookは`Stripe-Signature`を`STRIPE_WEBHOOK_SECRET`で検証します。署名が不正なリクエストは受け付けません。

## 顧客フロー

1. 顧客ポータルの「プラン・お支払い」を開く。
2. 未契約の場合、「有料プランを申し込む」から本契約ミニ / しっかり運用 / 発展運用を選択する。
3. Core APIがStripe Checkout Sessionを作成し、Stripeの決済画面へ移動する。
4. 決済成功後、Stripe Webhookが`customers.plan_id`と`customers.stripe_customer_id`を同期する。
5. `invoice.paid` / `invoice.payment_failed`を`payments`へ同期し、顧客ポータルの請求履歴に表示する。
6. 契約後はBilling Portalでカード情報・請求履歴・解約を管理する。

料金は`src/business-config.mjs`をSource of Truthとして使用します。現行月額は本契約ミニ3,980円、しっかり運用7,980円、発展運用17,800円で、すべて税込です。

## Billing Portal

Stripe Dashboard側でCustomer Portalを有効化してください。少なくとも次を許可します。

- 支払い方法の更新
- Invoice / 請求履歴の確認
- Subscriptionの解約

プラン変更をStripe Portal上で提供する場合は、Stripe Dashboard側のProduct / Price設定とPortal configurationも合わせて設定してください。

## 本番確認

1. StripeをTest modeにして環境変数を設定する。
2. テスト顧客で有料プラン申込を開始する。
3. Stripe Checkoutでテスト決済を完了する。
4. Portalへ戻ったあと、`customers.plan_id`と`stripe_customer_id`が反映されることを確認する。
5. `payments`に`invoice.paid`が1件だけ記録されることを確認する。
6. Billing Portalが開き、カード情報・請求履歴・解約が表示されることを確認する。
7. Webhook再送でも二重請求履歴にならないことを確認する。
8. Test mode完了後にLive key / Live webhook signing secretへ切り替える。
