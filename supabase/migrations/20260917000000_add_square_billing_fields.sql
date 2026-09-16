-- Square Billing linkage for customer subscriptions.
-- Stripe columns are intentionally retained for migration/history safety, but the
-- active v2 billing flow uses the Square fields added here.

alter table public.customers
  add column if not exists square_customer_id text,
  add column if not exists square_subscription_id text;

create unique index if not exists customers_square_customer_id_key
  on public.customers (square_customer_id)
  where square_customer_id is not null;

create unique index if not exists customers_square_subscription_id_key
  on public.customers (square_subscription_id)
  where square_subscription_id is not null;

alter table public.payments alter column provider set default 'square';

comment on column public.customers.square_customer_id is 'Square customer id used for Akinael AI billing.';
comment on column public.customers.square_subscription_id is 'Square subscription id for the active Akinael AI plan.';
