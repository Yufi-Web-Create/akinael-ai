-- Applied to production by Supabase migration tooling as version 20260908011350.
-- PHASE 6: durable, database-enforced idempotency for customer delivery approval
-- and its in-app notification. This migration is additive and does not publish a site.

alter table public.approvals
  add column if not exists idempotency_key text;

create unique index if not exists approvals_idempotency_key_unique
  on public.approvals (idempotency_key)
  where idempotency_key is not null;

alter table public.notifications
  add column if not exists idempotency_key text,
  add column if not exists delivery_status text not null default 'in_app',
  add column if not exists delivery_attempts integer not null default 0,
  add column if not exists last_error text;

alter table public.notifications
  drop constraint if exists notifications_delivery_status_check;

alter table public.notifications
  add constraint notifications_delivery_status_check
  check (delivery_status in ('in_app', 'pending_retry', 'failed'));

alter table public.notifications
  drop constraint if exists notifications_delivery_attempts_check;

alter table public.notifications
  add constraint notifications_delivery_attempts_check
  check (delivery_attempts >= 0);

create unique index if not exists notifications_idempotency_key_unique
  on public.notifications (idempotency_key)
  where idempotency_key is not null;
