-- UI redesign integration (feature/ui-redesign-integration).
--
-- The new Customer Portal "AIに相談" screen and the new Admin "司令塔AIチャット" screen
-- both need a durable, project-scoped conversational thread. Neither is a good fit for
-- the existing `messages` table: that table is the formal customer<->admin record tied
-- to `requests` (already read into AI Build/Review prompts by execution-store.mjs with
-- author_type limited to 'customer'/'admin' in application code), and this repo cannot
-- verify from here whether a DB-level CHECK constraint on messages.author_type would
-- reject a new value such as 'assistant' (base schema for this table predates this
-- repo's migrations — see docs/HANDOFF.md technical debt table). Adding a dedicated
-- table avoids any risk to that existing, already-production, table.
--
-- One table serves both new chat surfaces, discriminated by `channel`:
--   customer_consultation — pre-request "AIに相談" chat in the Customer Portal.
--   admin_command         — project-scoped "司令塔AIチャット" in the Admin console.
-- Only additive; no existing table is altered by this block.

create table if not exists public.ai_chat_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  project_id uuid not null references public.projects(id) on delete cascade,
  channel text not null check (channel in ('customer_consultation', 'admin_command')),
  role text not null check (role in ('user', 'assistant')),
  author_user_id uuid null,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_chat_messages_project_channel_idx
  on public.ai_chat_messages (project_id, channel, created_at);

alter table public.ai_chat_messages enable row level security;
-- No policies are added: this table is only ever reached through the Core API using
-- service_role, which bypasses RLS by default. Enabling RLS with zero policies is
-- defense in depth if a publishable/anon key is ever used against this table directly.

grant select, insert on table public.ai_chat_messages to service_role;

-- Portal "プラン・お支払い" needs a place to record which catalog plan (see
-- src/business-config.mjs, the pricing Source of Truth) a customer is currently on, and
-- an optional Stripe Customer Portal linkage. Both are purely descriptive/administrative
-- fields — writing them does not itself create a charge or subscription.
alter table public.customers add column if not exists plan_id text null;
alter table public.customers add column if not exists stripe_customer_id text null;
alter table public.customers add column if not exists notify_by_email boolean not null default true;
