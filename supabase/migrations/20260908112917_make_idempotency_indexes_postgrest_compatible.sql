-- PHASE 6: make PostgREST on_conflict=idempotency_key compatible with the
-- database uniqueness guarantee. PostgreSQL UNIQUE indexes allow multiple
-- NULL values, so removing the partial predicate preserves legacy NULL rows.

do $$
begin
  if exists (
    select 1
    from public.approvals
    where idempotency_key is not null
    group by idempotency_key
    having count(*) > 1
  ) then
    raise exception 'duplicate approval idempotency keys must be resolved before migration';
  end if;

  if exists (
    select 1
    from public.notifications
    where idempotency_key is not null
    group by idempotency_key
    having count(*) > 1
  ) then
    raise exception 'duplicate notification idempotency keys must be resolved before migration';
  end if;
end
$$;

drop index if exists public.approvals_idempotency_key_unique;
create unique index approvals_idempotency_key_unique
  on public.approvals (idempotency_key);

drop index if exists public.notifications_idempotency_key_unique;
create unique index notifications_idempotency_key_unique
  on public.notifications (idempotency_key);
